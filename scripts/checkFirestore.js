import db from "../src/config/firebase.js";

const checkUsers = async () => {
  const snapshot = await db.collection("users").get();

  console.log("Total users:", snapshot.size);

  snapshot.forEach((doc) => {
    console.log(doc.id, doc.data());
  });

  process.exit();
};

checkUsers();