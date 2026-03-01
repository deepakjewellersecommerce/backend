const multer=require('multer');

module.exports=multer({
    storage:multer.memoryStorage(),
    fileFilter:(req,file,cb)=>{
        if(!file.mimetype.match('image/jpeg|image/png|image/gif')){
            cb(new Error('File is not supported'),false)
            return
        }
        cb(null,true)
    }
}) 
 