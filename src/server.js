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
function emitError(io, targetType, target, errorMsg) {
  if (targetType === "single") {
    io.to(target).emit("error", { errorMsg });
  } else if (targetType === "all") {
    io.in(target).emit("error", { errorMsg });
  }
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
      (item) => (item.roomId = args.roomId)
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
  socket.on(
    "join-room",
    function ({ username, roomId, ipaddress, language }, callback) {
      try {
        //接続中のクライアントのIPアドレスのチェック
        // if (socket.client.conn.remoteAddress == ipaddress) {
        userList.push({ username });
        users.push({
          socketid: socket.id,
          ipaddres: ipaddress,
          roomId: roomId, //
          username: username,
          language: language,
        });
        socket.join(roomId);
        callback();
        //ユーザー参加通知のemit処理
        wsServer.in(roomId).emit("join-room-effect", userList); //
        //本体クライアントの入室時画面切り替え処理
        // } else {
        //ない場合は決めていない
        //テスト用に例外エラーを生成
        // throw new error();
        // }
      } catch (e) {
        console.error(e.message);
      }
    }
  );

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
        // 引数のタイプ判定
        if (
          typeof ipaddress !== "string" ||
          typeof fontColor !== "object" ||
          typeof fontSize_per !== "number"
        ) {
          emitError(
            socket,
            "single",
            target.socketId,
            "引数のタイプに問題があります。"
          );
          return;
        }

        try {
          socket
            .to(target.socketId)
            .emit("change-accessibility-effect", { fontSize_per, fontColor });
        } catch (e) {
          emitError(
            socket,
            "single",
            target.socketId,
            "エラーが発生しました。"
          );
        }
      }
    }
  );

  // 議題変更
  socket.on("updated-title", ({ roomId, title }) => {
    // ルームIDからルームを取得
    const targetRoom = rooms.find((room) => room.roomId === roomId);

    if (targetRoom !== undefined) {
      // 引数のタイプ判定
      if (typeof roomId !== "string" || typeof title !== "string") {
        emitError(
          wsServer,
          "all",
          targetRoom.roomId,
          "引数のタイプに問題があります。"
        );
        return;
      }

      // 議題変更通知
      try {
        wsServer.in(targetRoom.roomId).emit("updated-title-effect", { title });
      } catch (e) {
        emitError(wsServer, "all", targetRoom.roomId, "エラーが発生しました。");
      }
    }
  });

  // モード切替
  socket.on("change-mode", ({ ipaddress, mode }) => {
    // 引数のIPアドレスでユーザを識別
    const target = users.find((user) => user.ipaddress === ipaddress);

    if (target !== undefined) {
      // 引数のタイプ判定
      if (typeof ipaddress !== "string" || typeof mode !== "boolean") {
        emitError(
          socket,
          "single",
          target.socketId,
          "引数のタイプに問題があります。"
        );
        return;
      }

      // モード切替通知
      try {
        socket.to(target.socketId).emit("change-mode-effect", { mode });
        console.log("done");
      } catch (e) {
        emitError(socket, "single", target.socketId, "エラーが発生しました。");
      }
    }
  });
});

httpServer.listen(3000, handleListen);
