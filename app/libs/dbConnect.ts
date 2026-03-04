
import mongoose from "mongoose";

type ConnectionObject={
    isConnected?:number;
}

const connection:ConnectionObject={}
 
async function DbConnect():Promise<void>{
  console.log("Inside Mongo Connection");

    if(connection.isConnected){
        console.log("DB already connected")
        return 
    }
    try {
        console.log(process.env.MONGODB_URI);


        const db=await mongoose.connect(process.env.MONGODB_URI as string)
       connection.isConnected=db.connections[0].readyState
         console.log("DB connected Sucessfully")
    
    } catch (error:unknown) {
         console.log(" Error occurred while connecting to MongoDB", error)
         throw new Error("Failed to connect to MongoDB")
         
        
    }

  



}
  export default DbConnect;
