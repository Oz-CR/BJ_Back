db = db.getSiblingDB('BlackJackMongo');
db.createUser({
  user: "usuario",
  pwd: "clave123",
  roles: [{ role: "readWrite", db: "PersonasMongoDB" }]
});

db.testCollection.insertOne({
  message: "¡Hola Mundo!"
})