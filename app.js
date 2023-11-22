var express = require('express')
var bodyParser = require('body-parser');
var mongoose = require('mongoose')
var fs = require('fs');
var path = require('path');
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
require('dotenv').config();
const Grid = require("gridfs-stream")
const methodOverride = require('method-override');
const Contact = require('./models/contact');
//
const app = express();

app.set("view engine", "ejs");

app.use(express.urlencoded({
  extended: true
}));

app.use(express.static("public"));
app.use(methodOverride('_method'));

mongoose.set('strictQuery', true);

const mongoURI = process.env.DATABASE_URL;
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

let gfs;
const bucket_name = "images"
const db = mongoose.connection;
db.once('open', () => {
  // init stream
  gfs = Grid(db, mongoose.mongo)
  gfs.collection(bucket_name)
  gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: bucket_name,
  });
});

// Handle connection errors
db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});


function isValidImage(file) {
  // Check file size (64MB = 64 * 1024 * 1024 bytes)
  const maxSize = 64 * 1024 * 1024; // 64MB
  if (file.size > maxSize) {
    console.log('File exceeds the maximum size limit (64MB)');
    return false;
  }
  // Validate the file type
  if (!file.mimetype.startsWith('image')) {
    return false;
  };
  return true
}

// Storage
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    if (!isValidImage(file)) {
      return;
    }
    // Generate a unique file name, you can use any method to generate it.
    // In this example we are using Date.now() to generate unique name
    const filename = `${Date.now()}_${file.originalname}`;
    // Create an object containing the file information
    // It will be used by multer-gridfs-storage to save the file in MongoDB
    const fileInfo = {
      filename: filename,
      bucketName: bucket_name // specify the bucket name (change this and multer instanct to change which collection.files it saves to in Mongodb)
    };
    return fileInfo;
  }
})

const upload = multer({ storage });

app.get("/", async (req, res) => {
  const cursor = gfs.files.find({});
  const allFiles = await cursor.toArray();
  await cursor.close();

  res.render("imagePage", {
    files: allFiles,
  })

})

app.get("/files", async (req, res) => {

  const cursor = gfs.files.find({});
  const allValues = await cursor.toArray();
  await cursor.close();

  res.json(allValues)
})

app.get("/image/:filename", async (req, res) => {

  const cursor = gfs.files.find({ filename: req.params.filename });
  const files = await cursor.toArray();
  await cursor.close();

  files.map(file => {
    if (
      file.contentType === 'image/jpeg' ||
      file.contentType === 'image/png'
    ) {
      const readStream = gridfsBucket.openDownloadStream(file._id);
      readStream.pipe(res)
    }
  });

});


app.post('/', upload.single('image'), (req, res, next) => {
  res.redirect("/")
});


app.delete('/delete/:fileID', async (req, res) => {

  const obj_id = new mongoose.Types.ObjectId(req.params.fileID);
  await gridfsBucket.delete(obj_id)
  res.redirect('/');
});


//
app.get('/contact', (req, res) => {
  res.render('contact');
});

app.get('/contacts', async (req, res) => {
  let contact = await Contact.find({})
  // const cursor = gfs.files.find({});
  // const allFiles = await cursor.toArray();
  res.render("showContacts", {
    contact: contact,
  })
  // res.json(contact)
  // await cursor.close();

});
app.get('/contactsall', async (req, res) => {
  let contact = await Contact.find({})
  // const cursor = gfs.files.find({});
  // const allFiles = await cursor.toArray();
  // res.render("showContacts", {
  //   contact: contact,
  // })
  res.json(contact)
  // await cursor.close();

});
app.post("/contactForm", upload.single('image'), async (req, res) => {
  // const filter = { _id: ObjectId(userId) }; // Filter for a specific ObjectId
  // const filter = { name: req.body.contactName }
  // const update = { photo: req.body.filename }; // Update the 'age' field to 30

  // Contact.updateOne(filter, update)
  //   .then((result) => {
  //     console.log('Update result:', result);
  //     upload.single('image')
  //     // 'result' will contain information about the update operation
  //     // result.nModified will be 1 if a document matched the filter and was updated
  //   })
  //   .catch((error) => {
  //     console.error('Error updating document:', error);
  //   });

  console.log(JSON.stringify(req.body));

  const newContact = await Contact.create({
    name: req.body.contactName,
    email: req.body.contactEmail,
    message: req.body.contactMessage,
    photo: req.file.filename
  });
  await newContact.save();
  res.redirect("/contacts")
});


app.get('/download/:filename', async (req, res) => {

  const cursor = gfs.files.find({ filename: req.params.filename });
  const files = await cursor.toArray();
  const doc = files.pop();
  res.set('Content-disposition', `attachment; filename=` + req.params.filename);
  res.set('Content-Type', doc.contentType);
  await cursor.close();

  gridfsBucket.openDownloadStreamByName(doc.filename).pipe(res);
})

app.listen(process.env.PORT, err => {
  if (err)
    throw err
  console.log('Server listening on port', process.env.PORT)
})