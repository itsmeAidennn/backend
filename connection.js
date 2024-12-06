const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1/udm_admission',{
    // useNewUrlParser:true,
    // useUnifiedTopology:true
})
.then(()=>{
    console.log('mongoose connected');
})
.catch((e)=>{
    console.log('failed');
    console.log(e);
})

module.exports = mongoose.connection;