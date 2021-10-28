import http from "http";
import { Server } from "socket.io";
import express from "express";

const app = express();

const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// ルームIDの生成関数
function generateId(length) {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const charactersLength = characters.length;

  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

// エラー処理関数
function emitError(socket, target, errorMsg) {
  socket.to(target).emit("error", { errorMsg });
}

let rooms = [];
let userList = [];
let users = [];

// 開発サーバの駆動は「npm run dev」で！
// 下のブロックから機能実装！
wsServer.on("connection", (socket) => {
  // ルーム情報取得
  socket.on("get-room", (args, callback) => {
    const currentRoom = rooms.filter((item) => (item.roomId = args.roomId));
    const title = currentRoom.title;

    const currentRoomUsers = users.filter(
      (item) => (item.roomId === args.roomId)
    );

    const currentRoomUsersList = currentRoomUsers.map(function (item) {
      return item["username"];
    });

    callback({
      title: title,
      userList: currentRoomUsersList,
    });
  });

  // ルーム作成
  socket.on("create-room", (args, callback) => {
    const roomId = generateId(5);

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
  });

  //ルーム参加処理
  socket.on('join-room', function({username, roomId, ipaddress, language}, callback) {
    try{
      //接続中のクライアントのIPアドレスのチェック
      if(socket.client.conn.remoteAddress == ipaddress){
        socket.join(roomId);

        const currentRoomUsers = users.filter(
          (item) => (item.roomId === roomId)
        );
        const currentRoomUsersList = currentRoomUsers.map(function (item) {
          return item['username'];
        });

        users.push({
          socketId: socket.id, 
          ipaddres: ipaddress, 
          roomId: roomId,
          username: username,
          language: language
        });
        
        callback({
          userList: currentRoomUsersList
        });

        //ユーザー参加通知のemit処理
        wsServer.sockets.emit('join-room-effect', {userList: currentRoomUsersList});
        //本体クライアントの入室時画面切り替え処理
        socket.emit('change-screen-enter', {roomId, username});
      }
    }catch{
      
    }
  });

  // ルーム退出
  socket.on("leave-room", (args, callback) => {
    let user = users.find((item) => item.ipaddress === args.ipaddress);
    socket.leave(user.roomId);

    const removeIndex = users.findIndex(
      (item) => item.ipaddress === args.ipaddress
    );
    rooms.splice(removeIndex, 1);

    callback();
  });

  // ルーム解散
  socket.on("terminate-room", (args) => {
    const users = users.filter((item) => (item.roomId = args.roomId));

    wsServer.disconnectSockets(args.roomId);

    for (let i = 0; i < users.length; i++) {
      const removeIndex = users.findIndex(
        (item) => item.socketId === users[i].socketId
      );
      rooms.splice(removeIndex, 1);
    }

    const removeIndex = rooms.findIndex((item) => item.roomId === args.roomId);
    rooms.splice(removeIndex, 1);
  });

  // アクセシビリティ更新
  socket.on(
    "change-accessibility",
    ({ fontSize_per, fontColor, ipaddress }) => {
      // 引数のIPアドレスでユーザを識別
      const target = users.find((user) => user.ipaddress === ipaddress);

      // アクセシビリティ更新通知
      if (target !== undefined) {
        try {
          socket
            .to(target.id)
            .emit("change-accessibility-effect", { fontSize_per, fontColor });
        } catch (e) {
          emitError(socket, target.id, "エラーが発生しました。");
        }
      }
    }
  );

  // 議題変更
  socket.on("updated-title", ({ roomId, title }) => {
    // ルームIDからルームを取得
    const targetRoom = rooms.find((room) => room.roomId === roomId);

    // 議題変更通知
    if (targetRoom !== undefined) {
      try {
        socket.to(targetRoom.roomId).emit("updated-title-effect", { title });
      } catch (e) {
        emitError(socket, targetRoom.roomId, "エラーが発生しました。");
      }
    }
  });

  // モード切替
  socket.on("change-mode", ({ ipaddress, mode }) => {
    // 引数のIPアドレスでユーザを識別
    const target = users.find((user) => user.ipaddress === ipaddress);

    // モード切替通知
    if (target !== undefined) {
      try {
        socket.to(target.id).emit("change-mode-effect", { mode });
      } catch (e) {
        emitError(socket, target.id, "エラーが発生しました。");
      }
    }
  });
});

httpServer.listen(3000, handleListen);
