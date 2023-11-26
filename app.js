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

async function deleteFile(file) {
  const cursor = gfs.files.find({ filename: file });
  const files = await cursor.toArray();
  // console.log("FILES:" + JSON.stringify(files))

  await cursor.close();
  const obj_id = new mongoose.Types.ObjectId(files[0]._id);
  await gridfsBucket.delete(obj_id)

}
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

// Middleware for Multer uploads
//
const upload = multer({ storage });


app.get("/", async (req, res) => {
  const cursor = gfs.files.find({});
  const allFiles = await cursor.toArray();
  await cursor.close();
  res.render("imagePage", {
    files: allFiles,
  })

})


// Renders images
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

// Root Route to update images
app.post('/', upload.single('image'), (req, res, next) => {
  res.redirect("/")
});

app.delete('/delete/:fileID', async (req, res) => {
  const obj_id = new mongoose.Types.ObjectId(req.params.fileID);
  await gridfsBucket.delete(obj_id)
  res.redirect('/');
});


//
// Testing attaching files to models
//
app.get('/contact', (req, res) => {
  res.render('contact');
});

app.get('/contacts', async (req, res) => {
  let contact = await Contact.find({})
  res.render("showContacts", {
    contact: contact,
  })
});

// Updates images
// Adds new image to grid-fs
// Then updates model
app.post("/contact/update/:image_id/:old_filename", upload.single("image"), async (req, res) => {
  const filter = { _id: req.params.image_id }; // Filter for a specific ObjectId
  const update = { photo: req.file.filename }; // Update the 'photo'
  console.log(JSON.stringify(req.params))
  Contact.updateOne(filter, update)
    .then((result) => {
      deleteFile(req.params.old_filename);
      res.redirect("/contacts");
    })
    .catch((error) => {
      console.error('Error updating document:', error);
    });
});

app.post("/contactForm", upload.single('image'), async (req, res) => {
  const newContact = await Contact.create({
    name: req.body.contactName,
    email: req.body.contactEmail,
    message: req.body.contactMessage,
    photo: req.file.filename
  });
  await newContact.save();
  res.redirect("/contacts")
});


// DEBUG - Show all files and feilds
app.get("/files", async (req, res) => {
  const cursor = gfs.files.find({});
  const allValues = await cursor.toArray();
  await cursor.close()
  res.json(allValues)
})

// DEBUG Route to see all contacts
app.get('/contactsall', async (req, res) => {
  let contact = await Contact.find({})
  res.json(contact)
});

// Future download route
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