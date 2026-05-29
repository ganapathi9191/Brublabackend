import mongoose from "mongoose";

const connectDatabase = () => {
  mongoose
    .connect(process.env.MONGO_URI, {
       autoIndex: false
    })
    .then((data) => {
      console.log(`Servers is connected with server: ${data.connection.host}`);
    });
};


export default connectDatabase;