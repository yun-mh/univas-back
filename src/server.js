import http from "http";
import { Server, Socket } from "socket.io";
import express from "express";
import { timeLog } from "console";

const app = express();

const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

let rooms = [];
let userList = [];
let users = [];

function generateId(length) {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var charactersLength = characters.length;

  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

// エラー処理関数
function emitError(socket, target, errorMsg) {
  socket.to(target).emit("error", { errorMsg });
}

// 開発サーバの駆動は「npm run dev」で！
// 下のブロックから機能実装！
wsServer.on("connection", (socket) => {
  // アクセシビリティ更新(S -> B)
  socket.on(
    "change-accessibility",
    ({ fontSize_per, fontColor, ipaddress }) => {
      // 本体の識別値をusers配列の中からfor文使って取得し、そのデータから該当のsocketIdを取得
      // アクセシビリティ更新通知(B -> R)
      try {
        socket
          .to(ipaddress)
          .emit("change-accessibility-effect", { fontSize_per, fontColor });
      } catch (e) {
        emitError(socket, ipaddress, "エラーが発生しました。");
      }
    }
  );

  // 議題変更(S -> B)
  socket.on("updated-title", ({ roomId, title }) => {
    // データ架空の必要があれば処理して
    // 議題変更通知(B -> R)
    try {
      socket.to(roomId).emit("updated-title-effect", { title });
    } catch (e) {
      emitError(socket, ipaddress, "エラーが発生しました。");
    }
  });

  // モード切替(S -> B)
  socket.on("change-mode", ({ macaddress, mode }) => {
    // 本体の識別値を架空・処理
    // モード切替通知(B -> R)
    socket.to(macaddress).emit("change-mode-effect", { mode });
  });

  socket.on("test", (msg) => {
    // const clients = wsServer.sockets.adapter.rooms.get('abcde');
  });


  // CRT

  socket.on("get-room", (args, callback) => {
    
    const currentRoom = rooms.filter((item) => (item.roomId === args.roomId));
    const title = currentRoom.title;

    const currentRoomUsers = users.filter(
      (item) => (item.roomId === args.roomId)
    );
    
    var currentRoomUsersList = currentRoomUsers.map(function (item) {
      return item["username"];
    });

    callback({
      title : title,
      userList: currentRoomUsersList
    });

  });

  socket.on("create-room", (args, callback) => {
    let roomId = generateId(5);
    let id  = socket.id

    rooms.push({
      title: args.title,
      username: args.username,
      ipaddress: args.ipaddress,
      language: args.language,
      roomId: roomId,
    });

    users.push({
      socketId: socket.id,
      ipaddress: args.ipaddress,
      roomId: roomId,
      username: args.username,
      language: args.language,
    });

    socket.join(roomId);

    callback({
      roomId: roomId,
    });

    const username = args.username;

    const currentRoomUsers = users.filter(
      (item) => (item.roomId === args.roomId)
    );
    
    var currentRoomUsersList = currentRoomUsers.map(function (item) {
      return item["username"];
    });

    wsServer.in(roomId).emit("join-room-effect", ({userList: currentRoomUsersList}));
    socket.to(id).emit("change-screen-enter", ({roomId, username}));

  });

  socket.on("leave-room", (args) => {
    let user = users.find((item) => item.ipaddress === args.ipaddress);
    socket.leave(user.roomId);

    const removeIndex = users.findIndex(
      (item) => item.ipaddress === args.ipaddress
    );
    users.splice(removeIndex, 1);

    const currentRoomUsers = users.filter(
      (item) => (item.roomId === args.roomId)
    );
    
    var currentRoomUsersList = currentRoomUsers.map(function (item) {
      return item["username"];
    });
    
    socket.to(user.socketId).emit("change-screen-leave");
    wsServer.in(user.roomId).emit("leave-room-effect", ({userList: currentRoomUsersList}));

  });

  socket.on("terminate-room", (args) => {
    users = users.filter((item) => (item.roomId !== args.roomId));

    const removeIndex = rooms.findIndex((item) => item.roomId === args.roomId);
    rooms.splice(removeIndex, 1);
  
    socket.in(args.roomId).emit("change-screen-leave")
    wsServer.disconnectSockets(args.roomId);
    
    wsServer.emit("terminate-room-effect")
    
  });

});

httpServer.listen(3000, handleListen);
