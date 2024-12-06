const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const counterSchema = new mongoose.Schema({
  date: { type: String, unique: true },
  count: { type: Number, default: 0 },
});

const pendingUserVerificationSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  token: { type: String, required: true },
  formData: {
    uniqueID: {
      type: String,
      unique: true,
      required:true
    },
    firstName:{
      type:String
    },
    middleName:{
      type: String
    },
    lastName:{
      type:String
    },
    nameSuffix:{
      type:String
    },
    address:{
      type:String
    },
    gender:{
      type:String
    },
    strand: { 
      type: String
    },
    courseFirstChoice: {
      type: String
    },
    courseSecondChoice: {
      type: String
    },
    courseThirdChoice: {
      type: String
    },
    district: {
      type: String
    },
    schoolType: {
      type: String
    },
    contactNo:{
      type: String
    },
    email:{
      type:String
    }, 
    isEmailVerified: {
      type: Boolean
    },
    password:{
      type:String
    },
    documents:{
      psa:{
        isVerified: {type: String, default:null},
        name: {type: String, default: null},
        type: {type: String, default: null},
        data: {type: Buffer, default: null},
        createdAt: {
          type: Date,
          default: Date.now
        }
      },
      validID:{
        isVerified: {type: String, default:null},
        front: {
          name: {type: String, default: null},
          type: {type: String, default: null},
          data: {type: Buffer, default: null},
          createdAt: {
            type: Date,
            default: Date.now
          }
        },
        back: {
          name: {type: String, default: null},
          type: {type: String, default: null},
          data: {type: Buffer, default: null},
          createdAt: {
            type: Date,
            default: Date.now
          }
        },
      },
      academicCard:{
        isVerified: {type: String, default:null},
        front:{
          name: {type: String, default: null},
          type: {type: String, default: null},
          data: {type: Buffer, default: null},
          createdAt: {
            type: Date,
            default: Date.now
          }
        },
        back: {
          name:{type: String, default:null},
          type:{type: String, default: null},
          data: {type: Buffer, Default: null},
          createdAt:{ type: Date, default: Date.now
  
          }
        }
      },
      barangayCertResidency:{
        isVerified: {type: String, default:null},
        front:{
          name: {type: String, default: null},
          type: {type: String, default: null},
          data: {type: Buffer, default: null},
          createdAt: {
            type: Date,
            default: Date.now
        }
        },
        back:{
            name: {type: String, default: null},
            type: {type: String, default: null},
            data: {type: Buffer, default: null},
            createdAt: {
              type: Date,
              default: Date.now
        }
      }
      },
      votersIDCert:{
        isVerified: {type: String, default:null},
        front:{
            name: {type: String, default: null},
            type: {type: String, default: null},
            data: {type: Buffer, default: null},
            createdAt: {
              type: Date,
              default: Date.now
          }
        },
        back:{
          name: {type: String, default: null},
          type: {type: String, default: null},
          data: {type: Buffer, default: null},
          createdAt: {
            type: Date,
            default: Date.now
        }
        }
      },
      pictures:{
        isVerified: {type: String, default:null},
        front:{
          name: {type: String, default: null},
          type: {type: String, default: null},
          data: {type: Buffer, default: null},
          createdAt: {
            type: Date,
            default: Date.now
          }
        },
        back:{
            name: {type: String, default: null},
            type: {type: String, default: null},
            data: {type: Buffer, default: null},
            createdAt: {
              type: Date,
              default: Date.now
          }
        }
      }
    }
  },
  createdAt: { type: Date, default: Date.now, expires: '24h' }
});

const userSchema = new mongoose.Schema({
  uniqueID: {
    type: String,
    unique: true,
    required:true
  },
  firstName:{
    type:String
  },
  middleName:{
    type: String
  },
  lastName:{
    type:String
  },
  nameSuffix:{
    type:String
  },
  address:{
    type:String
  },
  gender:{
    type:String
  },
  contactNo:{
    type: String
  },
  email:{
    type:String
  }, 
  isEmailVerified:{
    type: Boolean
  },
  strand: { 
    type: String
  },
  courseFirstChoice: {
    type: String
  },
  courseSecondChoice: {
    type: String
  },
  courseThirdChoice: {
    type: String
  },
  district: {
    type: String
  },
  schoolType: {
    type: String
  },
  password: {
    type:String
  },
  examStatus: {
    type: String,
    enum: ['Pass', 'Fail', null],
    default: null,
  },  
  documents:{
    psa:{
      isVerified: {type: String, default:null},
      name: {type: String, default: null},
      type: {type: String, default: null},
      data: {type: Buffer, default: null},
      createdAt: {
        type: Date,
        default: Date.now
      }
    },
    validID:{
      isVerified: {type: String, default:null},
      front: {
        name: {type: String, default: null},
        type: {type: String, default: null},
        data: {type: Buffer, default: null},
        createdAt: {
          type: Date,
          default: Date.now
        }
      },
      back: {
        name: {type: String, default: null},
        type: {type: String, default: null},
        data: {type: Buffer, default: null},
        createdAt: {
          type: Date,
          default: Date.now
        }
      },
    },
    academicCard:{
      isVerified: {type: String, default:null},
      front:{
        name: {type: String, default: null},
        type: {type: String, default: null},
        data: {type: Buffer, default: null},
        createdAt: {
          type: Date,
          default: Date.now
        }
      },
      back: {
        name:{type: String, default:null},
        type:{type: String, default: null},
        data: {type: Buffer, Default: null},
        createdAt:{ type: Date, default: Date.now

        }
      }
    },
    barangayCertResidency:{
      isVerified: {type: String, default:null},
      front:{
        name: {type: String, default: null},
        type: {type: String, default: null},
        data: {type: Buffer, default: null},
        createdAt: {
          type: Date,
          default: Date.now
      }
      },
      back:{
          name: {type: String, default: null},
          type: {type: String, default: null},
          data: {type: Buffer, default: null},
          createdAt: {
            type: Date,
            default: Date.now
      }
    }
    },
    votersIDCert:{
      isVerified: {type: String, default:null},
      front:{
          name: {type: String, default: null},
          type: {type: String, default: null},
          data: {type: Buffer, default: null},
          createdAt: {
            type: Date,
            default: Date.now
        }
      },
      back:{
        name: {type: String, default: null},
        type: {type: String, default: null},
        data: {type: Buffer, default: null},
        createdAt: {
          type: Date,
          default: Date.now
      }
      }
    },
    pictures:{
      isVerified: {type: String, default:null},
      front:{
        name: {type: String, default: null},
        type: {type: String, default: null},
        data: {type: Buffer, default: null},
        createdAt: {
          type: Date,
          default: Date.now
        }
      },
      back:{
          name: {type: String, default: null},
          type: {type: String, default: null},
          data: {type: Buffer, default: null},
          createdAt: {
            type: Date,
            default: Date.now
        }
      }
    }
  }
},{
  timestamps: true
});

const testPDFUploadSchema = new mongoose.Schema({
  name: String,
  type: String,
  data: Buffer,
  createdAt: {
    type: Date,
    default: Date.now
  }
})

const scheduleSchema = new mongoose.Schema({
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduleDates: { type: [Date], required: true },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now }
});

const profilePicSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  data: { type: Buffer, required: true },
});

const pendingRegistrarSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  middleName: { type: String, default: ''},
  surname: { type: String, required: true },
  age: { type: Number, required: true },
  address: { type: String, required: true },
  uniqueID: {type: String, required: true, unique:true},
  password:{type:String},
  profilePic: { type: profilePicSchema, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const registrarSchema = new mongoose.Schema({
  firstName: String,
  middleName: String,
  surname: String,
  age: Number,
  address: String,
  uniqueID: {type: String, required: true, unique:true},
  isAdmin: {type: String, default: "No"},
  password:{type:String},
  profilePic: { type: profilePicSchema, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const roomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true },
  capacity: { type: Number, default: 25 },
  slotLeft: { type: Number, default: 25 },
})

const timeSlotSchema = new mongoose.Schema({
  startTime: { type: String, required: true },
  endTime: { type: String, required: true }
});

const examDatesSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const examInfoSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  room: { type: String, required: true },
  timeSlot: { type: String, required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const PendingUser = mongoose.model("PendingUser", pendingUserVerificationSchema);
const User = mongoose.model('User', userSchema);
const TestPDFUpload = mongoose.model('testPDFUpload', testPDFUploadSchema);
const Schedule = mongoose.model('Schedule', scheduleSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);
const PendingRegistrarAccount = mongoose.model('PendingRegistrar', pendingRegistrarSchema);
const RegistrarAccount = mongoose.model('Registrar', registrarSchema);
const Counter = mongoose.model("Counter", counterSchema);
const ExamRooms = mongoose.model("ExamRooms", roomSchema);
const TimeSlots = mongoose.model("TimeSlots", timeSlotSchema);
const ExamDates = mongoose.model("ExamDates", examDatesSchema);
const ExamInfo = mongoose.model("ExamInfo", examInfoSchema);

module.exports = {PendingUser, User, TestPDFUpload, Schedule, Feedback, PendingRegistrarAccount, RegistrarAccount, Counter, ExamRooms, TimeSlots, ExamDates, ExamInfo};