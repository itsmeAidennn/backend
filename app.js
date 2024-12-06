const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const nodemailer = require('nodemailer');
require('dotenv').config()
const session = require('express-session');
const cron = require('node-cron');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const stringSimilarity = require('string-similarity');
const {PendingUser, User, Schedule, Feedback, PendingRegistrarAccount, RegistrarAccount, Counter, ExamRooms, TimeSlots, ExamDates, ExamInfo} = require('./schemas');

var dbConnection = require('./connection');
const app = express ();
const port = 4040;
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
// const baseUrl = 'http://localhost:3000';

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use(express.urlencoded({ extended: true }));
const storage = multer.memoryStorage()
const upload= multer({
  storage: storage,
  limits: {fileSize: 5 * 1024 *1024}
});

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(session({
  key: 'session-cookie',
  secret: 'anotherRandomShit',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

cron.schedule('0 0 * * *', async () => { 
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() - 1);
  try {
    await PendingUserVerification.deleteMany({ createdAt: { $lt: expirationDate } });
    console.log("Cleaned up unverified accounts.");
  } catch (error) {
    console.error("Failed to clean up unverified accounts:", error);
  }
});

const transporter = nodemailer.createTransport ({
  host: 'smtp.gmail.com',
  port: 465,
  auth: {
    user: 'chriscelestinobackup@gmail.com',
    pass: 'euyd fsyo vljm jyvz'
  },
  tls: {
    rejectUnauthorized: false
  },
})

const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

const validateContactNoPh = (contactNo) => {
  const contactNoRegex  = /^09[0-9]{9}$/;
  return contactNoRegex.test(contactNo);
};

const validatePassword = (password) => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/
  return passwordRegex.test(password)
};

const sessionChecker = (req, res, next) => {
  if(req.session.userID) {
    next();
  } 
  else {
    res.status(401).json({
      message: "Kindly do the login process."
    })
  }
};

const sessionCheckerRegistrar = (req, res, next) => {
  if(req.session.regID) {
    next();
  } 
  else {
    res.status(401).json({
      message: "Kindly do the login process."
    })
  }
};

const generateRegistrarID = async (date = new Date()) => {
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const formattedDate = `${date.getFullYear()}-${month}-${day}`;

  const counter = await Counter.findOneAndUpdate(
    { date: formattedDate },
    { $inc: { count: 1 } },
    { new: true, upsert: true }
  );

  const sequence = String(counter.count).padStart(3, "0");

  return `${year}/${month}-${day}-${sequence}`;
};

const generateUserID = async (date = new Date()) => {
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const formattedDate = `${date.getFullYear()}-${month}-${day}`;

  const counter = await Counter.findOneAndUpdate(
    { date: formattedDate },
    { $inc: { count: 1 } },
    { new: true, upsert: true }
  );

  const sequence = String(counter.count).padStart(3, "0");

  return `${year}-${month}-${day}-${sequence}`;
};

const verificationPSA = ["Province", "City/Municipality", "Registry No.", "Childs First Name", "Middle Name", "Last Name", "Sex", "Date of Birth", "Place of Birth", "Barangay", "City/Municipality", "Province", "Type of Birth", "Birth Order", "Weight at Birth", "Mothers Maiden Name", "First", "Middle Name", "Last", "Citizenship", "Religion", "Total Number of children born alive:", "No. of children still living including this birth:", "No. of children born alive but are now dead:", "Occupation", "Age at this time of this birth: years", "Address", "Barangay", "City/Municipality", "Province", "Fathers First Name", "Middle Name", "Last", "Citizenship", "Religion", "Occupation", "Age", "MARRIAGE OF PARENTS", "Place", "Date", "if not married, accomplish Affidavit of Acknowledgement/Admission of Paternity at back.", "ATTENDANT", "Physician", "Nurse", "Midwife", "Hilot(Traditional Midwife)", "Others(Specify)", "Certification of Birth", "Informant", "Prepared By", "Received At the office of the civil registrar"];

const nationalIDFrontTextVerification = ["REPUBLIKA NG PILIPINAS", "Republic of the Philippines", "PAMBANSANG PAGKAKAKILANLAN", "Philippine Identification Card", "Apleyido/Last Name", "Mga Pangalan/Given Names", "Gitnang Apelyido/Middle Name", "Petsa ng Kapanganakan/Date of Birth", "Tirahan", "Address", "PHL"];

const nationalIDBackTextVerification = ["Araw ng pagkakaloob/Date of issue", "Kasarian", "sex", "Uri ng Dugo", "Blood Type", "Kalagayang Sibil", "Marital Status", "Lugar ng Kapanganakan", "Place of Birth", "If found, please return to the nearest PSA Office", "www.psa.gov.ph"];

const vaccineIDFrontTextVerification = ["City of Manila", "Covid-19", "Vaccination ID", "Date Registered", "Barangay", "Date Given", "Given By", "Lot #", "Expiry Date", "Brand", "1st Dose", "2nd Dose" ];

const vaccineIDBackTextVerification = ['City of Manila', "COVID-19 Vaccination Report", "1st Dose", "2nd Dose", "Vaccinator",  "This QR Code is for Verification  Scanning Only.", "This vacinnation passport can be used for whatever legal purpose this may serve best.", "Booster", "Date Given", "Given by", "Lot #", "Expiry Date", "Brand"];

const academicCardTextVerification = ["Last Name", "First Name", "Middle Name", "LRN", "Age", "Gender", "Track", "Strand", "School Year", "Grade Level", "Section", "Adviser Signature over Printed Name", "Principal"];

const brgyCertTextVerification = ["First Name", " Middle Initial", "Last Name", "Age", "Address", "Brgy. Address", " Zone no.", "District no.", "Date Issuance", "Chairman"];

const votersCertTextVerificaation = ["Last Name", "Given Name", "Middle Name", "Date of Birth", "Place of Birth", "Gender", "Civil Status", "Citizenship", "Address", "Date of Registration", "Barangay", "Precint no.", "VIN"]

const votersIDFrontTextVerification = ["VIN", "Last Name", "Given Name", "Middle Name", "Date of Birth", "Civil Status", "Citizenship", "Address", "Precint no."]

const preProcessedImage = async (imageBuffer) => {
  const newImageBuffer = Buffer.from(imageBuffer, 'base64');
  const preprocessedBuffer = await sharp(newImageBuffer)
  .grayscale()
  .threshold(128)
  .resize({width: 1000})
  .toFormat('jpeg')
  .toBuffer()
  return(preprocessedBuffer);
}

const extractText = async (imageType, imageBuffer) => {
  try {
    const imageInBaseSixFour = `data:${imageType};base64,${imageBuffer.toString('base64')}`;
      const {data:{text}} = await Tesseract.recognize(imageInBaseSixFour, 'eng', {
      });
      return text;
  }
  catch(e) {
    console.error("Text extraction failed: ", e);
    return null;
  }
}

const cleanText = (text) => {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\//g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
};

const validateMatches = (ocrResult, expectedWords, matchCountThreshold, similarityThreshold) => {
  let matchCount = 0;

  const cleanedOcrResult = cleanText(ocrResult);
  console.log(`Cleaned OCR Result (Array):`, cleanedOcrResult);

  for (const expectedWord of expectedWords) {
    const cleanedExpectedWords = cleanText(expectedWord);
    console.log(`Cleaned Expected Words (Array):`, cleanedExpectedWords);

    const isMatch = cleanedExpectedWords.some(cleanedExpectedWord =>
      cleanedOcrResult.some(ocrWord => {
        const similarityScore = stringSimilarity.compareTwoStrings(ocrWord, cleanedExpectedWord);
        return similarityScore >= similarityThreshold;
      })
    );

    if (isMatch) {
      matchCount++;
      console.log(`Match found for expected word(s):`, cleanedExpectedWords);
    }
  }

  console.log(`Total Match Count: ${matchCount}`);
  return matchCount >= matchCountThreshold;
};

// app.post('/api/requestEmailVerification', async (req, res) => {
//   try {
//     const { email, firstName, middleName, lastName, contactNo, password, ...otherData } = req.body;

//     if(!validateEmail(email)){
//       res.status(400).json({
//         success: false,
//         message: "Invalid Email"
//       })
//       return
//     }
//     else if(!validateContactNoPh(contactNo)){
//       res.status(400).json({
//         success: false,
//         message: "Invalid Contact Number"
//       })
//       return
//     }
//     else if(!validatePassword(password)){
//       res.status(400).json({
//         success: false,
//         message: "Invalid Password"
//       })
//       return
//     }
    
//     if (await User.findOne({ contactNo }) || await PendingUser.findOne({ contactNo })) {
//       return res.status(400).json({ success: false, message: "Contact Number already in use or awaiting verification." });
//     }

//     if (await User.findOne({ email }) || await PendingUser.findOne({ email })) {
//       return res.status(400).json({ success: false, message: "Email already in use or awaiting verification." });
//     }
    
//     const token = uuidv4();
//     const hashedPassword = await bcrypt.hash(req.body.password, 10);
//     const generatedUserID = await generateUserID();

//     const pendingUser = new PendingUser({
//       email,
//       token,
//       formData: {firstName, middleName, lastName, email: email, uniqueID: generatedUserID, isEmailVerified: true, ...otherData, password: hashedPassword }
//     });11
//     await pendingUser.save();

//     await transporter.sendMail({
//       from: 'UDM Admission <chriscelestinobackup@gmail.com>',
//       to: email,
//       subject: 'Verify your email',
//       html: `<p>Please verify your email by clicking the link below:</p>
//       <a href="${baseUrl}/api/verify-email/${token}">Verify Email</a>`
//     });

//     res.status(200).json({ success: true, message: "Verification email sent." });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: "An error occurred. Please try again." });
//   }
// });

app.post('/api/requestEmailVerification', upload.fields([
  { name: 'pictures', maxCount: 1 },
]), async (req, res) => {
  try {
    const { email, firstName, middleName, lastName, contactNo, password, ...otherData } = req.body;
    if(!validateEmail(email)){
      res.status(400).json({
        success: false,
        message: "Invalid Email"
      })
      return
    }
    else if(!validateContactNoPh(contactNo)){
      res.status(400).json({
        success: false,
        message: "Invalid Contact Number"
      })
      return
    }
    else if(!validatePassword(password)){
      res.status(400).json({
        success: false,
        message: "Invalid Password"
      })
      return
    }
    const pictures = req.files.pictures ? req.files.pictures[0] : null;

    if (pictures) {
      otherData.documents = {
        pictures: {
          front: {
            name: pictures.originalname,
            type: pictures.mimetype,
            data: pictures.buffer,
            createdAt: new Date(),
          },
        },
      };
    }

    const token = uuidv4();
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const generatedUserID = await generateUserID();

    const pendingUser = new PendingUser({
      email,
      token,
      formData: {firstName, middleName, lastName, contactNo, email: email, uniqueID: generatedUserID, isEmailVerified: true, ...otherData, password: hashedPassword }
    });

    await pendingUser.save();
    await transporter.sendMail({
      from: 'UDM Admission <chriscelestinobackup@gmail.com>',
      to: email,
      subject: 'UDM Admission - Email Verification Required',
      html: `
        <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
        <p>Thank you for starting your application to <strong>Universidad De Manila</strong>! To complete your registration, please verify your email address.</p>
        <p><strong>Click the link below to verify your email:</strong></p>
        <p><a href="${baseUrl}/api/verify-email/${token}">Verify Email</a></p>
        <p>If you did not initiate this request, please ignore this email. For any concerns, contact us at <strong>chriscelestinobackup@gmail.com</strong>.</p>
        <br />
        <p>Best regards,</p>
        <p><strong>Ms. Loida J. Primavera</strong><br />
        University Registrar<br />
        <strong>Universidad De Manila</strong></p>
      `,
    });
    res.status(200).json({ success: true, message: "Verification email sent." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "An error occurred. Please try again." });
  }
});

app.post('/api/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const pendingUser = await PendingUser.findOne({ token });
    if (!pendingUser) {
      return res.status(400).json({ success: false, message: "Invalid or expired token." });
    }

    const { email, firstName, lastName, uniqueID } = pendingUser.formData;

    const newUser = new User(pendingUser.formData);
    await newUser.save();

    await PendingUser.deleteOne({ token });

    await transporter.sendMail({
      from: 'UDM Admission <chriscelestinobackup@gmail.com>',
      to: email,
      subject: 'UDM Admission - Applicant ID Notification',
      html: `
        <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
        <p>Thank you for applying to <strong>Universidad De Manila</strong>! We are pleased to inform you that your application has been successfully received.</p>
        <p><strong>Your Applicant ID: ${uniqueID}</strong></p>
        <p>Please keep this ID safe, as it will be required for future correspondence, tracking your application status, and any related processes.</p>
        <p>To check your application status or for further updates, please visit our admissions portal at <strong><a href="localhost:3000/">The UDM Admission Page</a></strong>.</p>
        <p>If you have any questions, feel free to contact us at <strong>chriscelestinobackup@gmail.com</strong> or reply to this email.</p>
        <p>We appreciate your interest in <strong>Universidad De Manila</strong> and look forward to assisting you throughout the admission process!</p>
        <br />
        <p>Best regards,</p>
        <p><strong>Ms. Loida J. Primavera</strong><br />
        University Registrar<br />
        <strong>Universidad De Manila</strong></p>
      `,
    });

    res.status(201).json({ success: true, message: "Email verified and account created!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Verification failed. Try again or contact support." });
  }
});

app.post('/api/landingPageLogin', async(req, res) => {
  try {
    const userDetails = await User.findOne({email: req.body.email});
    if(userDetails !== null) {
      result = bcrypt.compareSync(req.body.password, userDetails.password);
      if (result === false){
      // if (req.body.password !== userDetails.password){
        res.status(400).json({
          success: false,
          message: "Password did not match"
        })
        return
      } else {
        req.session.userID = userDetails._id
        res.status(200).json({
          success: true,
          message: "Logged in sucessfuly.",
        })
        return
      }
    } 
    else {  
      res.status(400).json({
        success: false,
        message: "Invalid Email"
      })
      return
    }
  } 
  catch (e) { 
    console.log(e)
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please give a feedback regarding this and let the devs know."
    })
    return
  }
});

app.post('/api/landingPageSignUp', async(req, res) => {
  try {
    const {password, firstName, middleName, lastName, nameSuffix, address, gender, strand, courseFirstChoice, courseSecondChoice, courseThirdChoice, schoolType, district, contactNo, email} =  req.body;
    console.log(req.body)
    const hashedPassword = await bcrypt.hash(password, 10);
    const ifEmailExisted = await User.findOne({email: req.body.email});
    const ifContactNoExisted = await User.findOne({contactNo: req.body.contactNo});
    const generatedUserID = await generateUserID();
    if(!validateEmail(email)){
      res.status(400).json({
        success: false,
        message: "Invalid Email"
      })
      return
    }
    else if(!validateContactNoPh(contactNo)){
      res.status(400).json({
        success: false,
        message: "Invalid Contact Number"
      })
      return
    }
    else if(!validatePassword(password)){
      res.status(400).json({
        success: false,
        message: "Invalid Password"
      })
      return
    }
    else if(ifEmailExisted !== null){
      res.status(400).json({
        success: false,
        message: "Email already existed!"
      })
      return
    }
    else if(ifContactNoExisted !== null){
      res.status(400).json({
        success: false,
        message: "Contact number already existed!"
      })
      return
    }
    else {
      const insertUser = new User({
        firstName,
        middleName,
        lastName,
        nameSuffix,
        address,
        gender,
        strand,
        courseFirstChoice,
        courseSecondChoice,
        courseThirdChoice,
        contactNo,
        district,
        schoolType,
        email,
        uniqueID: generatedUserID,
        password: hashedPassword
      })
      const result = await insertUser.save();

      req.session.userID = result._id;
      console.log(req.session.user);
      res.status(201).json({
        success: true,
        message: "Created an Account Successfuly!",
      })
      return
    }
  } catch (err) {
    console.log(err)
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please give a feedback regarding this and let the devs know."
    })
    return
  }
});

app.get('/api/exam-result/:uniqueID', async (req, res) => {
  try {
    const { uniqueID } = req.params;

    if (!uniqueID) {
      return res.status(400).json({ message: 'Unique ID is required.' });
    }

    const user = await User.findOne({ uniqueID }).select('firstName middleName lastName uniqueID examStatus');

    if (!user) {
      return res.status(404).json({ message: 'Applicant not found.' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching exam result:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/submitFeedback', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    const feedback = new Feedback({
      name,
      email,
      subject,
      message
    });

    await feedback.save();

    res.status(200).json({
      message: 'Feedback submitted successfully!'
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      message: 'There was an error submitting your feedback. Please try again later.'
    });
  }
});

app.post('/api/sessionChecker', async(req, res) => {
  if (req.session.userID) {
    return res.json({isAuthenticated : true});
  }
  else {
    res.clearCookie('session-cookie');
    return res.json({isAuthenticated: false});
  }
});

app.post('/api/profileInformations', sessionChecker, async (req, res) => {
  try {
    const userID = req.session.userID;
    if(!userID){
      res.status(401).json({
        success: false,
        message: "You are not authorized to enter!"
      })
      return
    }
    const userDetails = await User.findById(userID).select('firstName middleName lastName nameSuffix address gender contactNo email uniqueID documents.psa.name documents.psa.isVerified documents.validID.front.name documents.validID.back.name documents.validID.isVerified documents.academicCard.front.name documents.academicCard.back.name documents.academicCard.isVerified documents.barangayCertResidency.front.name documents.barangayCertResidency.back.name documents.barangayCertResidency.isVerified documents.votersIDCert.front.name documents.votersIDCert.back.name documents.votersIDCert.isVerified documents.pictures.front.name documents.pictures.back.name documents.pictures.isVerified documents.pictures.front.type examStatus');
    res.status(200).json({
      success: true,
      message: "User data fetched succesfuly.",
      user: userDetails
    })
  } 
  catch (e) {
    console.log(e);
    res.status(401).json({
      success: false,
      message: "Somethinging went wrong with finding the user informations."
    })
  }
})

app.post('/api/profileImages', sessionChecker, async (req, res) => {
  try {
    const userID = req.session.userID;
    if(!userID){
      res.status(401).json({
        success: false,
        message: "You are not authorized to enter!"
      })
      return
    }
    const documents = await User.findById(userID);
    if (documents === null) {
      res.status(404).json({
        success: false,
        message: "User Document images was not found!"
      })
    }
    const documentImages = {
      psa: documents.documents.psa.data ? documents.documents.psa.data.toString('base64') : null,
      validID: {
        front: documents.documents.validID.front.data ? documents.documents.validID.front.data.toString('base64') : null,
        back: documents.documents.validID.back.data ? documents.documents.validID.back.data.toString('base64') : null
      },
      academicCard: {
        front: documents.documents.academicCard.front.data ? documents.documents.academicCard.front.data.toString('base64') : null,
        back: documents.documents.academicCard.back.data ? documents.documents.academicCard.back.data.toString('base64') : null
      },
      barangayCertResidency: {
        front: documents.documents.barangayCertResidency.front.data ? documents.documents.barangayCertResidency.front.data.toString('base64') : null,
        back: documents.documents.barangayCertResidency.back.data ? documents.documents.barangayCertResidency.back.data.toString('base64') : null
      },
      votersIDCert: {
        front: documents.documents.votersIDCert.front.data ? documents.documents.votersIDCert.front.data.toString('base64') : null,
        back: documents.documents.votersIDCert.back.data ? documents.documents.votersIDCert.back.data.toString('base64') : null
      },
      pictures: {
        front: documents.documents.pictures.front.data ? documents.documents.pictures.front.data.toString('base64') : null,
      }
    };
    res.status(200).json({
      success: true,
      message: "Images are now converted",
      images: documentImages
    })
  }
  catch (e) { 
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Somethinging went wrong with finding the user images"
    })
  }
})

app.put('/api/saveNewInfo', async(req, res) => {
  try {
    console.log(req.body);
    const updatedUser = await User.findByIdAndUpdate(
      req.session.userID,{ 
      $set: {[req.body.infoToUpdate]: req.body.newInfo} },
      { new: true }
    );
    req.session.user = updatedUser._id;
    res.status(200).json({
      message: 'Information updated successfuly!'
    });
  }
  catch(e) {
    res.status(500).json({
      success: false,
      message: "Error uploading your new Information."
    });
    console.log(e);
  }
})

app.put('/api/ImageFileUpload', sessionChecker, upload.single('file') ,async(req, res) => {
  try {
    const userID = req.session.userID;
    const applicantDocument = await User.findById(userID);
    const fileKind = req.body.fileKind;
    const fileSide = req.body.fileSide || null; 
    const fileType = req.file.mimetype
    const fileBuffer = req.file.buffer;
    if (!fileKind || !fileBuffer) {
      return res.status(400).json({
        success: false,
        message: "Missing document name or file."
      });
    }
    let isVerifiedField = `documents.${fileKind}.isVerified`;
    let fieldToUpdate =  `documents.${fileKind}`;
    if (fileSide) {
      fieldToUpdate = `documents.${fileKind}.${fileSide}`;
    }
    const updatedDocument = {
      name: req.file.originalname,
      type: fileType,
      data: fileBuffer
    };
    if (!applicantDocument) {
      return res.status(404).json({ message: 'User not found' });
    }

    applicantDocument.set(fieldToUpdate, updatedDocument);
    applicantDocument.set(isVerifiedField, null);

    await applicantDocument.save();

    req.session.user = applicantDocument._id;
    res.status(200).json({
      message: 'Image uploaded successfuly!'
    });
  } catch (error) {
    res.status(500).send("Error uploading file");
    console.log(error);
  }
});

app.put('/api/ImageFileDelete', sessionChecker, upload.single('file') ,async(req, res) => {
  try {
    const userID = req.session.userID;
    const applicantDocument = await User.findById(userID);
    const fileKind = req.body.fileKind;
    const fileSide = req.body.fileSide || null; 
    let isVerifiedField = `documents.${fileKind}.isVerified`;
    let fieldToUpdate =  `documents.${fileKind}`;
    if (fileSide) {
      fieldToUpdate = `documents.${fileKind}.${fileSide}`;
    }
    const updatedDocument = {
      name: null,
      type: null,
      data: null
    };
    if (!applicantDocument) {
      return res.status(404).json({ message: 'User not found' });
    }

    applicantDocument.set(fieldToUpdate, updatedDocument);
    applicantDocument.set(isVerifiedField, false);

    await applicantDocument.save();

    req.session.user = applicantDocument._id;
    res.status(200).json({
      message: 'Image deleted successfuly!'
    });
  } catch (error) {
    res.status(500).send("Error uploading file");
    console.log(error);
  }
});

app.post('/api/validatePSA', sessionChecker, async(req, res) => {
  try {
    const userID = req.session.userID;
    const applicantDocument = await User.findById(userID);

    if(applicantDocument.documents.psa.data === null){
      res.status(400).json({
        valid: true,
        message: 'Lack document image.'
      });
      return;
    }

    const preProcessedResultFront = await preProcessedImage(applicantDocument.documents.psa.data);
    const resultFront = await extractText(applicantDocument.documents.psa.type, preProcessedResultFront);
    
    if (resultFront) {

      // console.log(resultFront);
      const isFrontValid = validateMatches(resultFront, verificationPSA, 5, 0.1);
      // console.log(isFrontValid);

      if (isFrontValid === false) {
        res.status(400).json({
          valid: false,
          message: "The PSA that you uploaded was not validated, maybe try to upload a better one?"
        });
        return;
      }

      if (isFrontValid) {
        applicantDocument.set('documents.psa.isVerified', true);
        await applicantDocument.save();
        res.status(200).json({
          valid: true,
          message: 'Your Documents had been Validated!'
        });;
      }

      else {
        res.status(400).json({
          valid: false,
          message: "Your documents was not validated, maybe try to upload a better one?"
        });
      }
    }
    else {
      res.status(501).json({
        valid: true,
        message: 'Extraction Failed.'
      });;
    }
  }
  catch(e) { 
    console.log(e);
    res.status(501).json({
      valid: false,
      message: 'Something went wrong in the process, please leave a feedback about this.'
    });
  }
})

app.post('/api/validateID', sessionChecker, async(req, res) => {
  try {
    const userID = req.session.userID;
    const applicantDocument = await User.findById(userID);
    const IDType = req.body.validIDType;
    let verificationToUseFront = null;
    let verificationToUseBack = null;

    if(IDType === null) {
      res.status(400).json({
        valid: true,
        message: "You didn't select a proper ID type."
      });
      return;
    }

    switch (IDType) {
      case "vaccineCard":
        verificationToUseFront = vaccineIDFrontTextVerification;
        verificationToUseBack = vaccineIDBackTextVerification;
        break; 
      case "nationalID":
        verificationToUseFront = nationalIDFrontTextVerification;
        verificationToUseBack = nationalIDBackTextVerification;
    }

    if(applicantDocument.documents.validID.front.data === null || applicantDocument.documents.validID.back.data === null){
      res.status(400).json({
        valid: true,
        message: 'Lack of document images. You must upload the front and back image of the document first.'
      });
      return;
    }

    const preProcessedResultFront = await preProcessedImage(applicantDocument.documents.validID.front.data);
    const preProcessedResultBack = await preProcessedImage(applicantDocument.documents.validID.back.data);
    const resultFront = await extractText(applicantDocument.documents.validID.front.type, preProcessedResultFront);
    const resultBack = await extractText(applicantDocument.documents.validID.back.type, preProcessedResultBack);

    
    if (resultFront && resultBack) {

      console.log(resultFront);
      const isFrontValid = validateMatches(resultFront, verificationToUseFront, 3, 0.1);
      console.log(isFrontValid);

      console.log(resultBack);
      const isBackValid = validateMatches(resultBack, verificationToUseBack, 8, 0.1);
      console.log(isBackValid);

      if (isBackValid === false) {
        res.status(400).json({
          valid: false,
          message: "The Back part of your document was not validated, maybe try to upload a better one?"
        });
        return;
      }

      if (isFrontValid === false) {
        res.status(400).json({
          valid: false,
          message: "The Front part of your documents was not validated, maybe try to upload a better one?"
        });
        return;
      }

      if (isBackValid && isFrontValid) {
        applicantDocument.set('documents.validID.isVerified', true);
        await applicantDocument.save();
        res.status(200).json({
          valid: true,
          message: 'Your Documents had been Validated!'
        });;
      }
      else {
        res.status(400).json({
          valid: false,
          message: "Your documents was not validated, maybe try to upload a better one?"
        });
      }
    }
    else {
      console.log(result);
      res.status(501).json({
        valid: true,
        message: 'Extraction Failed.'
      });;
    }
  }
  catch(e) { 
    console.log(e);
    res.status(501).json({
      valid: false,
      message: 'Something went wrong in the process, please leave a feedback about this.'
    });
  }
})

app.post('/api/validateAcademicCard', sessionChecker, async (req, res) => {
  try {
    const userID = req.session.userID;
    const applicantDocument = await User.findById(userID);
    let verificationToUseFront = academicCardTextVerification;

    if (!applicantDocument.documents.academicCard.front.data) {
      return res.status(400).json({
        valid: false,
        message: "Front image of the document is required. Please upload the front image."
      });
    }

    const preProcessedResultFront = await preProcessedImage(applicantDocument.documents.academicCard.front.data);
    const resultFront = await extractText(applicantDocument.documents.academicCard.front.type, preProcessedResultFront);

    const isFrontValid = resultFront ? validateMatches(resultFront, verificationToUseFront, 3, 0.1) : false;

    let isBackValid = true;

    if (!isFrontValid) {
      return res.status(400).json({
        valid: false,
        message: "The front part of your document could not be validated. Please try uploading a clearer image."
      });
    }

    if (!isBackValid) {
      return res.status(400).json({
        valid: false,
        message: "The back part of your document could not be validated. Please try uploading a clearer image."
      });
    }

    if (isFrontValid && isBackValid) {
      applicantDocument.set('documents.academicCard.isVerified', true);
      await applicantDocument.save();
      return res.status(200).json({
        valid: true,
        message: 'Your documents have been validated successfully!'
      });
    } else {
      return res.status(400).json({
        valid: false,
        message: "Document validation failed. Please try uploading clearer images."
      });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      valid: false,
      message: 'An error occurred during processing. Please try again later.'
    });
  }
});

app.post('/api/validateBrgyCertID', sessionChecker, async (req, res) => {
  try {
    const userID = req.session.userID;
    const applicantDocument = await User.findById(userID);
    const IDType = req.body.brgyCertIDType;
    let verificationToUseFront = null;
    let verificationToUseBack = null;
    let isBackRequired = true;

    if (IDType === null) {
      res.status(400).json({
        valid: false,
        message: "You didn't select a proper type."
      });
      return;
    }

    switch (IDType) {
      case "ID":
        verificationToUseFront = brgyCertTextVerification;
        break;
      case "cert":
        verificationToUseFront = brgyCertTextVerification;
        isBackRequired = false;
        break;
    }

    if (!applicantDocument.documents.barangayCertResidency.front.data) {
      res.status(400).json({
        valid: false,
        message: 'Front image of the document is required. Please upload the front image.'
      });
      return;
    }

    if (isBackRequired && !applicantDocument.documents.barangayCertResidency.back.data) {
      res.status(400).json({
        valid: false,
        message: 'Back image of the document is required. Please upload the back image.'
      });
      return;
    }

    const preProcessedResultFront = await preProcessedImage(applicantDocument.documents.barangayCertResidency.front.data);
    const resultFront = await extractText(applicantDocument.documents.barangayCertResidency.front.type, preProcessedResultFront);
    const isFrontValid = resultFront ? validateMatches(resultFront, verificationToUseFront, 3, 0.1) : false;

    let isBackValid = true;
    if (isBackRequired) {
      const preProcessedResultBack = await preProcessedImage(applicantDocument.documents.barangayCertResidency.back.data);
      const resultBack = await extractText(applicantDocument.documents.barangayCertResidency.back.type, preProcessedResultBack);
      isBackValid = resultBack ? validateMatches(resultBack, verificationToUseBack, 8, 0.1) : false;
    }

    if (isFrontValid && isBackValid) {
      applicantDocument.set('documents.barangayCertResidency.isVerified', true);
      await applicantDocument.save();
      res.status(200).json({
        valid: true,
        message: 'Your documents have been validated!'
      });
    } else {
      res.status(400).json({
        valid: false,
        message: isFrontValid ? "The back part of your document could not be validated." : "The front part of your document could not be validated."
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({
      valid: false,
      message: 'An error occurred during processing. Please try again later.'
    });
  }
});

app.post('/api/validateVotersCertID', sessionChecker, async (req, res) => {
  try {
    const userID = req.session.userID;
    const applicantDocument = await User.findById(userID);
    const IDType = req.body.votersCertIDType;
    let verificationToUseFront = null;
    let verificationToUseBack = null;
    let isBackRequired = false;

    if (IDType === null) {
      res.status(400).json({
        valid: false,
        message: "You didn't select a proper type."
      });
      return;
    }

    switch (IDType) {
      case "ID":
        verificationToUseFront = votersIDFrontTextVerification;
        isBackRequired = false;
        break;
      case "cert":
        verificationToUseFront = votersCertTextVerificaation;
        isBackRequired = false;
        break;
    }

    if (!applicantDocument.documents.votersIDCert.front.data) {
      res.status(400).json({
        valid: false,
        message: 'Front image of the document is required. Please upload the front image.'
      });
      return;
    }

    if (isBackRequired && !applicantDocument.documents.votersIDCert.back.data) {
      res.status(400).json({
        valid: false,
        message: 'Back image of the document is required. Please upload the back image.'
      });
      return;
    }

    const preProcessedResultFront = await preProcessedImage(applicantDocument.documents.votersIDCert.front.data);
    const resultFront = await extractText(applicantDocument.documents.votersIDCert.front.type, preProcessedResultFront);
    const isFrontValid = resultFront ? validateMatches(resultFront, verificationToUseFront, 3, 0.1) : false;

    let isBackValid = true;
    if (isBackRequired) {
      const preProcessedResultBack = await preProcessedImage(applicantDocument.documents.votersIDCert.back.data);
      const resultBack = await extractText(applicantDocument.documents.votersIDCert.back.type, preProcessedResultBack);
      isBackValid = resultBack ? validateMatches(resultBack, verificationToUseBack, 8, 0) : false;
    }

    if (isFrontValid && isBackValid) {
      applicantDocument.set('documents.votersIDCert.isVerified', true);
      await applicantDocument.save();
      res.status(200).json({
        valid: true,
        message: 'Your documents have been validated!'
      });
    } else {
      res.status(400).json({
        valid: false,
        message: isFrontValid ? "The back part of your document could not be validated." : "The front part of your document could not be validated."
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({
      valid: false,
      message: 'An error occurred during processing. Please try again later.'
    });
  }
});

function categorizeStatus(documentName, status, summary) {
  if (status === null) {
    summary.nullStatus.push(documentName);
  } else if (status === "true") {
    summary.trueStatus.push(documentName);
  } else if (status === "verified") {
    summary.verifiedStatus.push(documentName);
  }
}

function getNextBusinessDays(startOffset = 0, numDays = 3) {
  const today = new Date();
  const availableDays = [];
  let nextDay = new Date(today);
  nextDay.setDate(nextDay.getDate() + startOffset);
  let businessDays = 0;

  while (businessDays < numDays) {
    nextDay.setDate(nextDay.getDate() + 1);
    const dayOfWeek = nextDay.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6  && dayOfWeek !== 7 && dayOfWeek !== 1) {
      availableDays.push(nextDay.toISOString().split('T')[0]);
      businessDays++;
    }
  }

  return availableDays;
}

app.post('/api/scheduleDocumentSubmission', sessionChecker, async (req, res) => {
  try {
    const userID = req.session.userID;
    const applicantDocument = await User.findById(userID);
    let existingSchedule = await Schedule.findOne({ userID: userID }).populate('userID');
    const verificationSummary = {
      nullStatus: [],
      trueStatus: [],
      verifiedStatus: []
    };


    const categorizeDocuments = (documents) => {
      Object.entries(documents).forEach(([docType, docContent]) => {
        if (docType === "pictures") return;
        if (docContent.isVerified !== undefined) {
          categorizeStatus(docType, docContent.isVerified, verificationSummary);
        } else {
          Object.entries(docContent).forEach(([side, sideContent]) => {
            if (sideContent.isVerified !== undefined) {
              categorizeStatus(`${docType} (${side})`, sideContent.isVerified, verificationSummary);
            }
          });
        }
      });
    };

    if (existingSchedule) {
      categorizeDocuments(existingSchedule.userID.documents);
      if (verificationSummary.nullStatus.length > 0) {
        await existingSchedule.remove();
        return res.status(200).json({
          message: 'There are documents that need verification. Deleted your old schedule',
          data: verificationSummary,
          scheduleDates: null
        });
      }
      return res.status(200).json({
        message: 'Schedule already exists.',
        scheduleDates: existingSchedule.scheduleDates,
        data: verificationSummary
      });
    }

    categorizeDocuments(applicantDocument.documents);

    if (verificationSummary.nullStatus.length > 0) {
      return res.status(200).json({
        message: 'There are documents that need verification.',
        data: verificationSummary,
        scheduleDates: null
      });
    }

    const scheduleDates = getNextBusinessDays(0, 3);
    const schedule = new Schedule({
      userID: userID,
      scheduleDates: scheduleDates
    });
    await schedule.save();

    res.status(200).json({
      message: 'All documents were already checked by the system, your document will now be checked by the registrar themselves',
      data: verificationSummary,
      scheduleDates: scheduleDates
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Couldn't evaluate your documents at the moment."
    });
  }
});

app.get("/api/user-schedule", async (req, res) => {
  try {
    if (!req.session || !req.session.userID) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }

    const userID = req.session.userID;

    const userSchedule = await ExamInfo.find({ students: userID })
      .populate("students", "firstName lastName uniqueID")
      .exec();

    if (!userSchedule || userSchedule.length === 0) {
      return res
        .status(404)
        .json({ error: "No schedule found." });
    }

    res.json({ schedule: userSchedule });
  } catch (error) {
    console.error("Error fetching user schedule:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


app.get('/api/users', async (req, res) => {
  try {
    const {
      name,
      id, 
      gender, 
      strand, 
      examStatus,
      page = 1,
      limit = 15,
    } = req.query;

    const query = {};

    if (id) query.uniqueID = id;
    if (gender) query.gender = gender;
    if (strand) query.strand = strand;
    if (examStatus) {
      query.examStatus = examStatus === 'InProgress' ? null : examStatus;
    }
    if (name) {
      query.$or = [
        { firstName: { $regex: name, $options: 'i' } },
        { middleName: { $regex: name, $options: 'i' } },
        { lastName: { $regex: name, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-password -documents')
      .exec();

    const total = await User.countDocuments(query);

    res.json({
      users,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.patch('/api/users/:id/exam-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pass', 'Fail'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findOneAndUpdate(
      { uniqueID: id },
      { examStatus: status },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: `User marked as ${status}`, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/fetchSchedules', async (req, res) => {
  try {
    const { 
      name, 
      id, 
      gender, 
      strand, 
      page = 1, 
      limit = 15, 
      date 
    } = req.query;

    const query = {};

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      query.scheduleDates = { $elemMatch: { $gte: startOfDay, $lte: endOfDay } };
    }

    const userQuery = {};
    if (id) userQuery._id = id;
    if (gender) userQuery.gender = gender;
    if (strand) userQuery.strand = strand;
    if (name) {
      userQuery.$or = [
        { firstName: { $regex: name, $options: 'i' } },
        { middleName: { $regex: name, $options: 'i' } },
        { lastName: { $regex: name, $options: 'i' } },
      ];
    }

    const schedules = await Schedule.find(query)
      .populate({
        path: 'userID',
        match: userQuery,
        select: 'firstName middleName lastName gender strand documents',
      })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .exec();

      const filteredSchedules = schedules
      .filter((schedule) => schedule.userID)
      .map((schedule) => {
        const documents = {};
    
        for (const [docType, docData] of Object.entries(schedule.userID.documents || {})) {
          documents[docType] = {};
    
          for (const [side, sideData] of Object.entries(docData || {})) {
            if (sideData && sideData.data) {
              documents[docType][side] = {
                name: sideData.name,
                type: sideData.type,
                base64Data: sideData.data.toString('base64'),
              };
            }
          }
        }
    
        return {
          ...schedule.toObject(),
          userID: {
            ...schedule.userID.toObject(),
            documents: documents, 
          },
        };
      });

  
    const total = await Schedule.countDocuments(query);

    res.json({
      schedules: filteredSchedules,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.put('/api/RegistrarVerifiy', async (req, res) => {
  try {
    const { userID, document, decision } = req.body;

    if (!userID) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!document) {
      return res.status(404).json({ message: 'The document that you want to verify does not exist.' });
    }
    if (!decision) {
      return res.status(404).json({ message: 'Please enter a valid decision!' });
    }

    // if (!userID || !document || !decision) {
    //   return res.status(400).json({ message: 'There has been a glitch, please contact a dev or leave a review.' });
    // }
    const updateField = `documents.${document}.isVerified`;
    // const user = await User.findByIdAndUpdate(
    //   userID,
    //   { $set: { [updateField]: "verified" } },
    //   { new: true }
    // );
    if (decision === true) {
      const user = await User.findByIdAndUpdate(
        userID,
        { $set: { [updateField]: "verified" } },
        { new: true }
      );
      res.json({ message: `Document ${document} verified successfully`, user });  
    }
    if (decision === false) {
      const user = await User.findByIdAndUpdate(
        userID,
        { $set: { [updateField]: null } },
        { new: true }
      );  
      res.json({ message: `Document ${document} deleted successfully`, user });
    }
    // const user = await User.findByIdAndUpdate(
    //   userID,
    //   { $set: { [updateField]: decision } },
    //   { new: true }
    // );
  } catch (error) {
    console.error('Error updating document status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/registrarLogin', async(req, res) => {
  try {
    const userDetails = await RegistrarAccount.findOne({uniqueID: req.body.uniqueID});
    if(userDetails !== null) {
      result = bcrypt.compareSync(req.body.password, userDetails.password);
      if (result === false){
        res.status(400).json({
          success: false,
          message: "Password did not match"
        })
        return
      } else {
        req.session.regID = userDetails._id
        res.status(200).json({
          success: true,
          message: "Logged in sucessfuly.",
        })
        return
      }
    } 
    else {  
      res.status(400).json({
        success: false,
        message: "Invalid ID"
      })
      return
    }
  } 
  catch (e) { 
    console.log(e)
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please give a feedback regarding this and let the devs know."
    })
    return
  }
});

app.put("/api/RegistrarSignup", upload.single("profilePic"), async (req, res) => {
    try {
      const { firstName, middleName, surname, age, address, password } = req.body;
      if (!firstName || !surname || !age || !address || !password || !req.file) {
        return res.status(400).json({
          success: false,
          message: "All fields and a profile picture are required.",
        });
      }
      
      if(!validatePassword(password)){
        res.status(400).json({
          success: false,
          message: "Invalid Password"
        })
        return
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const generatedRegistrarID = await generateRegistrarID();

      const fileType = req.file.mimetype;
      const fileBuffer = req.file.buffer;

  
      const newPendingSignup = new PendingRegistrarAccount({
        firstName,
        middleName,
        surname,
        age,
        address,
        uniqueID: generatedRegistrarID,
        password: hashedPassword,
        profilePic: {
          name: req.file.originalname,
          type: fileType,
          data: fileBuffer,
        },
      });
      await newPendingSignup.save();
      
      // const approvedAccount = new RegistrarAccount({
      //   firstName,
      //   middleName,
      //   surname,
      //   age,
      //   address,
      //   uniqueID: generatedRegistrarID,
      //   password: hashedPassword,
      //   isAdmin: "Yes",
      //   profilePic: {
      //     name: req.file.originalname,
      //     type: fileType,
      //     data: fileBuffer,
      //   },
      // });
      // await approvedAccount.save();

      res.status(200).json({
        success: true,
        message: "Signup request submitted for approval.",
      });
    } catch (error) {
      console.error("Error during signup:", error);
      res.status(500).json({
        success: false,
        message: "Error processing signup.",
      });
    }
  }
);

app.post('/api/sessionCheckerRegistrar', async(req, res) => {
  if (req.session.regID) {
    return res.json({isAuthenticated : true});
  }
  else {
    res.clearCookie('session-cookie');
    return res.json({isAuthenticated: false});
  }
});

app.post('/api/getRegProfile', sessionCheckerRegistrar, async (req, res) => {
  try {
    const userID = req.session.regID;
    if(!userID){
      res.status(401).json({
        success: false,
        message: "You are not authorized to enter!"
      })
      return
    }
    
    let imageInBase64 = {}

    const userDetails = await RegistrarAccount.findById(userID);
    
    if (userDetails.profilePic && userDetails.profilePic.data) {
      imageInBase64 = {
        ...userDetails.profilePic.toObject(),
        data: userDetails.profilePic.data.toString('base64')
      }
    }

    const userData = {
      ...userDetails.toObject(),
      profilePic: imageInBase64
    }

    console.log(userData);
    res.status(200).json({
      success: true,
      message: "User data fetched succesfuly.",
      user: userData
    })
  } 
  catch (e) {
    console.log(e);
    res.status(401).json({
      success: false,
      message: "Something went wrong with finding the user informations."
    })
  }
})

app.get("/api/pendingRegistrars", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pendingAccounts = await PendingRegistrarAccount.find()
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const totalAccounts = await PendingRegistrarAccount.countDocuments();

    res.status(200).json({
      success: true,
      pendingAccounts,
      totalPages: Math.ceil(totalAccounts / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("Error fetching pending accounts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending accounts.",
    });
  }
});

app.post("/api/registrarAccountAction", async (req, res) => {
  const { accountId, action } = req.body;

  if (!accountId || !action) {
    return res.status(400).json({
      success: false,
      message: "Account ID and action are required.",
    });
  }

  try {
    const account = await PendingRegistrarAccount.findById(accountId);

    // console.log(accountId);
    // console.log(account);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    if (action === "approve") {
      // const approvedAccount = new RegistrarAccount(account);
      const approvedAccount = new RegistrarAccount({
        firstName: account.firstName,
        middleName: account.middleName,
        surname: account.surname,
        age: account.age,
        address: account.address,
        uniqueID: account.uniqueID,
        password: account.password,
        profilePic: {
          name: account.profilePic.name,
          type: account.profilePic.type,
          data: account.profilePic.data
        },
      });
      await approvedAccount.save();
      await PendingRegistrarAccount.deleteOne({ _id: accountId });

      return res.status(200).json({
        success: true,
        message: "Account approved and moved to RegistrarAccount.",
      });
    } else if (action === "reject") {
      await PendingRegistrarAccount.deleteOne({ _id: accountId });

      return res.status(200).json({
        success: true,
        message: "Account rejected and removed from pending list.",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid action provided.",
      });
    }
  } catch (error) {
    console.error("Error processing account action:", error);
    res.status(500).json({
      success: false,
      message: "Error processing account action.",
    });
  }
});

app.get('/api/get-examination-rooms', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    const rooms = await ExamRooms.find()
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .sort({ roomNumber: 1 }); 

    const totalRooms = await ExamRooms.countDocuments();

    const totalPages = Math.ceil(totalRooms / limitNumber);

    res.json({
      rooms,
      currentPage: pageNumber,
      totalPages,
      totalRooms,
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/search-rooms', async (req, res) => {
  try {
    const { roomNumber, capacity } = req.query;

    const query = {};
    if (roomNumber) query.roomNumber = { $regex: roomNumber, $options: 'i' };
    if (capacity) query.capacity = +capacity;

    const rooms = await ExamRooms.find(query).sort({ roomNumber: 1 });

    res.json({ rooms });
  } catch (error) {
    console.error('Error searching rooms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/add-examination-rooms', async (req, res) => {
  try {
    const { roomNumber, capacity } = req.body;

    if (!roomNumber) {
      return res.status(400).json({ error: 'Room number is required' });
    }

    const existingRoom = await ExamRooms.findOne({ roomNumber });
    if (existingRoom) {
      return res.status(400).json({ error: 'Room with this number already exists' });
    }

    const newRoom = new ExamRooms({ roomNumber, capacity, slotLeft: capacity});
    const savedRoom = await newRoom.save();

    res.status(201).json({
      savedRoom,
      sucess: true,
      message: "Exam Room Added succesfully!"
    });
  } catch (error) {
    console.error('Error adding room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/edit-room/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { roomNumber, capacity } = req.body;

    const existingRoom = await ExamRooms.findOne({ roomNumber });
    if (existingRoom) {
      return res.status(400).json({ error: 'Room with this number already exists' });
    }

    const updatedRoom = await ExamRooms.findByIdAndUpdate(
      id,
      { roomNumber, capacity },
      { new: true, runValidators: true }
    );

    if (!updatedRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(updatedRoom);
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/delete-room/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedRoom = await ExamRooms.findByIdAndDelete(id);

    if (!deletedRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/get-time-slots', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const timeSlots = await TimeSlots.find()
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const totalTimeSlots = await TimeSlots.countDocuments();
    const totalPages = Math.ceil(totalTimeSlots / limit);

    res.json({ timeSlots, totalPages });
  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/search-time-slots', async (req, res) => {
  try {
    const { startTime, endTime } = req.query;

    const query = {};
    if (startTime) query.startTime = { $regex: `^${startTime}`, $options: 'i' }; 
    if (endTime) query.endTime = { $regex: `^${endTime}`, $options: 'i' };

    const timeSlots = await TimeSlots.find(query).sort({ startTime: 1 });
    res.json({ timeSlots });
  } catch (error) {
    console.error('Error searching time slots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/add-time-slot', async (req, res) => {
  try {
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Start time and end time are required' });
    }

    const newTimeSlot = new TimeSlots({ startTime, endTime });
    const savedTimeSlot = await newTimeSlot.save();

    res.status(201).json({
      savedTimeSlot,
      message: 'Time slot added successfully!',
    });
  } catch (error) {
    console.error('Error adding time slot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/edit-time-slot/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime } = req.body;

    const updatedTimeSlot = await TimeSlots.findByIdAndUpdate(
      id,
      { startTime, endTime },
      { new: true, runValidators: true }
    );

    if (!updatedTimeSlot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    res.json(updatedTimeSlot);
  } catch (error) {
    console.error('Error editing time slot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/delete-time-slot/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedTimeSlot = await TimeSlots.findByIdAndDelete(id);

    if (!deletedTimeSlot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    res.json({ message: 'Time slot deleted successfully' });
  } catch (error) {
    console.error('Error deleting time slot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/get-exam-dates', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const totalDates = await ExamDates.countDocuments();
    const totalPages = Math.ceil(totalDates / limit);

    const dates = await ExamDates.find()
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ dates, totalPages });
  } catch (error) {
    console.error('Error fetching exam dates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/add-exam-date', async (req, res) => {
  try {
    const { date, description } = req.body;

    if (!date || !description) {
      return res.status(400).json({ error: 'Both date and description are required' });
    }

    const newExamDate = new ExamDates({ date, description });
    const savedDate = await newExamDate.save();

    res.json({ message: 'Exam date added successfully', savedDate });
  } catch (error) {
    console.error('Error adding exam date:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// app.get('/api/search-exam-dates', async (req, res) => {
//   try {
//     const { date } = req.query;

//     if (!date) {
//       return res.status(400).json({ error: 'Date query parameter is required.' });
//     }

//     const searchDate = new Date(date);
//     console.log(searchDate)
//     console.log(isNaN(searchDate));
//     if (isNaN(searchDate)) {
//       console.error('Invalid date format:', date);
//       return res.status(400).json({ error: 'Invalid date format.' });
//     }

//     const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
//     const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

//     console.log('Searching for exam dates between:', startOfDay, 'and', endOfDay);

//     const examDates = await ExamDates.find({
//       examDate: {
//         $gte: startOfDay,
//         $lte: endOfDay,
//       },
//     }).sort({ examDate: 1 });

//     res.json({ examDates });
//   } catch (error) {
//     console.error('Error searching exam dates:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

app.put('/api/edit-exam-date/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, description } = req.body;

    if (!date || !description) {
      return res.status(400).json({ error: 'Both date and description are required' });
    }

    const updatedDate = await ExamDates.findByIdAndUpdate(
      id,
      { date, description },
      { new: true, runValidators: true }
    );

    if (!updatedDate) {
      return res.status(404).json({ error: 'Exam date not found' });
    }

    res.json(updatedDate);
  } catch (error) {
    console.error('Error editing exam date:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/delete-exam-date/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedDate = await ExamDates.findByIdAndDelete(id);

    if (!deletedDate) {
      return res.status(404).json({ error: 'Exam date not found' });
    }

    res.json({ message: 'Exam date deleted successfully' });
  } catch (error) {
    console.error('Error deleting exam date:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/api/reg-get-exam-dates", async (req, res) => {
  try {
    const examDates = await ExamDates.find({});
    res.status(200).json({ examDates });
  } catch (error) {
    console.error("Error fetching exam dates:", error.message);
    res.status(500).json({ error: "Failed to fetch exam dates." });
  }
});

app.get("/api/reg-get-examination-rooms", async (req, res) => {
  try {
    const rooms = await ExamRooms.find({});
    res.status(200).json({ rooms });
  } catch (error) {
    console.error("Error fetching rooms:", error.message);
    res.status(500).json({ error: "Failed to fetch examination rooms." });
  }
});

app.get("/api/reg-get-time-slots", async (req, res) => {
  try {
    const timeSlots = await TimeSlots.find({});
    res.status(200).json({ timeSlots });
  } catch (error) {
    console.error("Error fetching time slots:", error.message);
    res.status(500).json({ error: "Failed to fetch time slots." });
  }
});

app.get("/api/reg-get-users", async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 });
    res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

app.get('/api/checkSlotLeft', async (req, res) => {
  const { date, room, timeSlot } = req.query;

  if (!date || !room || !timeSlot) {
    return res.status(400).json({ error: 'Date, room, and timeSlot are required' });
  }

  try {
    const examInfo = await ExamInfo.findOne({ date, room, timeSlot });
    const roomData = await ExamRooms.findOne({ roomNumber: room });

    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const capacity = roomData.capacity;
    if (typeof capacity !== 'number') {
      return res.status(500).json({ error: 'Invalid room capacity data' });
    }

    const students = Array.isArray(examInfo?.students) ? examInfo.students : [];
    const slotsLeft = capacity - students.length;

    return res.json({ slotsLeft });
  } catch (error) {
    console.error('Error checking slots:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post("/api/giveSchedule", async (req, res) => {
  const { date, room, timeSlot, studentID } = req.body;

  try {
    const studentHasSchedule = await ExamInfo.findOne({students: studentID});
    const studentInfo = await User.findOne({_id: studentID}); 
    if (studentHasSchedule) {
      return res
        .status(400)
        .json({ error: "Student already has a schedule." });
    }

    const existingSchedule = await ExamInfo.findOne({
      date,
      room,
      timeSlot,
    });
  
    if (existingSchedule) {
      if (existingSchedule.students.includes(studentID)) {
        return res
          .status(400)
          .json({ error: "Student already assigned to this schedule." });
      }

      existingSchedule.students.push(studentID);
      await existingSchedule.save();
      return res.json({ message: "Student added to existing schedule." });
    }

    const roomCapacity = await ExamRooms.findOne({ roomNumber: room }).select(
      "capacity"
    );

    const newSchedule = new ExamInfo({
      date,
      room,
      timeSlot,
      students: [studentID],
      capacity: roomCapacity.capacity,
    });

    await newSchedule.save();

    const dateString = new Date(date);

    const formattedDate = dateString.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    await transporter.sendMail({
      from: 'UDM Admission <chriscelestinobackup@gmail.com>',
      to: studentInfo.email,
      subject: 'UDM Admission - UDMCAT Qualification Notification',
      html: `
        <p>Dear <strong>${studentInfo.firstName} ${studentInfo.lastName}</strong>,</p>
        <br />
        <p>Thank you for your interest in <strong>Universidad De Manila</strong>. After reviewing your application, we are pleased to inform you that <strong>you qualify</strong> to take the UDM College Admission Test (UDMCAT).</p>
        <p>Here are the exam details:/<p>
        <br />
        <p>Date: ${formattedDate}</p>
        <p>Time Slot: ${timeSlot}</p>
        <p>Room: ${room}</p>
        <br />
        Please bring the following items with you:
        <br />
        <ul>
          <li>Pencil</li>
          <li>Ballpen</li>
          <li>Papers for scratch</li>
          <li>Proper attitude</li>
        </ul>
        We look forward to seeing you at the exam.
        <br />
        <p>Best regards,</p>
        <p><strong>Ms. Loida J. Primavera</strong><br />
        University Registrar<br />
        <strong>Universidad De Manila</strong></p>
      `,
    });
    res.json({ message: "New schedule created." });
  } catch (error) {
    console.error("Error assigning schedule:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get('/api/exam-schedules', async (req, res) => {
  try {
    const {
      date,
      room,
      startTime,
      endTime,
      page = 1,
      limit = 5,
    } = req.query;

    const query = {};

    if (date) query.date = new Date(date);
    if (room) query.room = room;
    if (startTime && endTime) {
      query.timeSlot = {
        $gte: `${startTime}`,
        $lte: `${endTime}`,
      };
    }

    const schedules = await ExamInfo.find(query)
      .sort({ date: 1, timeSlot: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .exec();

    const total = await Schedule.countDocuments(query);

    res.json({
      schedules,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/exam-schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedSchedule = await ExamInfo.findByIdAndDelete(id);

    if (!deletedSchedule) {
      return res.status(404).json({ message: 'Schedule not found.' });
    }

    res.json({ message: 'Schedule deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.get('/api/exam-schedules/:id/students', async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await ExamInfo.findById(id).populate('students', 'firstName lastName uniqueID');

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    res.json(schedule.students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete("/api/removeStudentFromSchedule", async (req, res) => {
  const { scheduleID, studentID } = req.body;

  try {
    const schedule = await ExamInfo.findById(scheduleID);
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found." });
    }

    const studentIndex = schedule.students.indexOf(studentID);
    if (studentIndex === -1) {
      return res.status(400).json({ error: "Student not found in this schedule." });
    }

    schedule.students.splice(studentIndex, 1);
    await schedule.save();

    res.json({ message: "Student removed successfully." });
  } catch (error) {
    console.error("Error removing student from schedule:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/school-count", async (req, res) => {
  try {
    const counts = await User.aggregate([
      {
        $group: {
          _id: "$schoolType", 
          count: { $sum: 1 },
        },
      },
    ]);

    const result = counts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const response = {
      Public: result.Public || 0,
      Private: result.Private || 0,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("Error fetching school counts:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/users/count", async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    res.status(200).json({ totalUsers: userCount });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user count" });
  }
});

app.get("/users/strand-count", async (req, res) => {
  try {
    const strandCounts = await User.aggregate([
      { 
        $match: { strand: { $ne: null } } 
      },
      {
        $group: {
          _id: "$strand", 
          count: { $sum: 1 } 
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.status(200).json(strandCounts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch strand counts" });
  }
});

const courseToDepartment = {
  "Bachelor of Science in Nursing": "College of Health Sciences",
  "Bachelor of Science in Physical Therapy": "College of Health Sciences",
  "Bachelor of Science in Psychology": "College of Health Sciences",
  "Bachelor of Science in Social Work": "College of Health Sciences",
  "Bachelor of Science in Criminology": "College of Criminal Justice",
  "Bachelor of Science in Information System with specialization in Cybersecurity": "College of Engineering and Technology",
  "Bachelor of Science in Information System with specialization in Data Science": "College of Engineering and Technology",
  "Bachelor of Science in Information Technology": "College of Engineering and Technology",
  "Bachelor of Science in Business Administration major in Marketing Management": "College of Business Administration",
  "Bachelor of Science in Business Administration major in Human Resources Management": "College of Business Administration",
  "Bachelor of Science in Business Administration major in Economics": "College of Business Administration",
  "Bachelor of Science in Entrepreneurship": "College of Business Administration",
  "Bachelor of Secondary Education major in English": "College of Education",
  "Bachelor of Secondary Education major in Mathematics": "College of Education",
  "Bachelor of Secondary Education major in General Science": "College of Education",
  "Bachelor of Secondary Education major in Social Science": "College of Education",
  "Bachelor of Physical Education": "College of Education",
  "BS Hospitality Management": "College of Hospitality Management",
  "BSHM with specialization in Travel Operations": "College of Hospitality Management",
  "BSHM with specialization in Recreation and Leisure": "College of Hospitality Management",
  "BSHM with specialization in Heritage and Culture": "College of Hospitality Management",
  "Bachelor of Arts in Communication": "College of Arts and Sciences",
  "Bachelor of Arts in Political Science": "College of Arts and Sciences",
  "Bachelor of Public Administration": "College of Arts and Sciences"
};

app.get("/users/department-count", async (req, res) => {
  try {
    const departmentCounts = await User.aggregate([
      {
        $project: {
          courses: [
            "$courseFirstChoice",
            "$courseSecondChoice",
            "$courseThirdChoice"
          ]
        }
      },
      { $unwind: "$courses" },
      {
        $group: {
          _id: {
            $switch: {
              branches: Object.entries(courseToDepartment).map(([course, department]) => ({
                case: { $eq: ["$courses", course] },
                then: department
              })),
              default: null
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } } 
    ]);

    res.status(200).json(departmentCounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch department counts" });
  }
});

app.get("/users/district-count", async (req, res) => {
  try {
    const users = await User.find({}); 
    const districtCounts = {
      "District 1": 0,
      "District 2": 0,
      "District 3": 0,
      "District 4": 0,
      "District 5": 0,
      "District 6": 0
    };

    users.forEach((user) => {
      const district = user.district;
      if (district && districtCounts[district] !== undefined) {
        districtCounts[district]++;
      }
    });

    res.status(200).json(districtCounts);  
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch district counts" });
  }
});



app.post('/api/logout', (req,res) => {
  try {
    req.session.destroy((err) => {
      if(err) {
        res.status(500).json({
          succeess: false,
          message: "Logged out failed"
        })
        return
      }
      res.clearCookie('session-cookie');
      res.status(201).json({
        success: true,
        message: "Logged out successfully"
      })
    })
  }   catch (e) {
    console.log(e);
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

// 24-11-19-000