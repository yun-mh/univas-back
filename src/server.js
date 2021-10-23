import http from "http";
import { Server, Socket } from "socket.io";
import express from "express";

const app = express();

const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

let rooms = [];
let userList = []
let users = []

function generateId(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var charactersLength = characters.length;
 
  for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
 }

 return result;
}

wsServer.on("connection", (socket) => {

  socket.on("test", (msg) => {
    // const clients = wsServer.sockets.adapter.rooms.get('abcde');

  })

  socket.on("get-room", (args, callback) => {
    const currentRoom = rooms.filter(item => item.roomId = args.roomId);
    const title = currentRoom.title;

    const currentRoomUsers = userList.filter(item => item.roomId = args.roomId);
    var currentRoomUsersList = currentRoomUsers.map(function(item) {
      return item['username'];
    });
    callback({
      userList: currentRoomUsersList,
      title : title
    })
  })

  socket.on("create-room", (args, callback) => {
    let roomId = generateId(5);
  
    rooms.push({
      title: args.title, 
      username: args.username, 
      ipaddress: args.ipaddress, 
      language: args.language, 
      roomId: roomId
    });

    userList.push({
      socketId : socket.id,
      ipaddress : args.ipaddress,
      roomId : roomId,
      username: args.username,
      language: args.language
    })

    socket.join(roomId);

    callback({
      roomId: roomId
    });
  })

  socket.on("leave-room", (args, callback) => {
    let user = userList.find(item => item.ipaddress === args.ipaddress);
    socket.leave(user.roomId)

    const removeIndex = userList.findIndex( item => item.ipaddress === args.ipaddress );
    rooms.splice( removeIndex, 1 );

    callback();
  })

  socket.on("terminate-room", (args) => {
    const users = userList.filter(item => item.roomId = args.roomId);

    wsServer.disconnectSockets(args.roomId)

    for (let i = 0; i < users.length ; i++){
      const removeIndex = userList.findIndex( item => item.socketId === users[i].socketId );
      rooms.splice( removeIndex, 1 );
    }

    const removeIndex = rooms.findIndex( item => item.roomId === args.roomId );
    rooms.splice( removeIndex, 1 );
  })


});

httpServer.listen(3000, handleListen);
