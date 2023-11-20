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
//
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
const db = mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const conn = mongoose.createConnection(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

let gfs;
const bucket_name = "images"
conn.once("open", () => {
  // init stream
  gfs = Grid(conn.db, mongoose.mongo)
  gfs.collection(bucket_name)
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: bucket_name,
  });
})

function isValidFile(file) {
  if (file.mimetype === 'image/png'
    || file.mimetype == "image/jpg"
    || file.mimetype == "image/jpeg") {
    return true
  } else {
    return false
  }
}
// Storage
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    if (isValidFile(file)) {
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
  }

});

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

app.post("/contactForm", upload.single('image'), async (req, res) => {
  // add contact
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