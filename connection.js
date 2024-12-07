const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://bahanjennie:HujBtmme4RPnUYqV@cluster1.gjcx2.mongodb.net/udm_admission',{
    
    useNewUrlParser:true,
    useUnifiedTopology:true
})
.then(()=>{
    console.log('mongoose connected');
})
.catch((e)=>{
    console.log('failed');
    console.log(e);
})

module.exports = mongoose.connection;
