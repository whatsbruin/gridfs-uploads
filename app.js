var express = require('express')
var bodyParser = require('body-parser');
var mongoose = require('mongoose')
var fs = require('fs');
var path = require('path');
const multer = require("multer");
const {GridFsStorage} = require("multer-gridfs-storage"); 
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
    // gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    //   bucketName: bucket_name //collection name (change this and multer instanct to change which collection.files it saves to in Mongodb)
    // });
    gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
      bucketName: bucket_name,
    });
  });
// Storage
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
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
});

const upload = multer({ storage });

app.get("/", async (req, res) => {
    const cursor = gfs.files.find({});
    const allFiles = await cursor.toArray();
    res.render("imagePage", {
      files: allFiles,   
    })
    await cursor.close();

})

app.get("/files",  async (req, res) => {

  const cursor = gfs.files.find({});
  const allValues = await cursor.toArray();
  res.json(allValues)
})

app.get("/image/:filename",  async (req, res) => {
    
  const cursor = gfs.files.find({filename: req.params.filename});
  const allValues = await cursor.toArray();
  const readStream = gridfsBucket.openDownloadStream(allValues[0]._id);
  readStream.pipe(res)
  await cursor.close();
});


app.post('/', upload.single('image'), (req, res, next) => { 
    // get the file from the request
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
  //   const allFiles = await cursor.toArray();
    res.render("showContacts", {
      contact: contact,   
    })
    // await cursor.close();

});

app.post("/contactForm", upload.single('image'), async (req, res) => {
  // const name = req.body.name;
  // console.log(req.file)
  // getting site key from client side
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



app.listen(process.env.PORT, err => {
    if (err)
        throw err
    console.log('Server listening on port', process.env.PORT)
})