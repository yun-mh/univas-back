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
