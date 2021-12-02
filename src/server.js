import http from "http";
import { Server } from "socket.io";
import express from "express";

import { Database } from "./database";
import { SERVER_DISCONNECT } from "./constants";
import {
  emitErrorToSelf,
  emitErrorToDevice,
  emitErrorToAll,
  generateRoomId,
  getUserList,
  getDeviceByUniqueId,
} from "./utils";
import { Translate } from "@google-cloud/translate/build/src/v2";
import  CREDENTIALS  from "../Credential.json"
import { time } from "console";

const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new Database();

const translate = new Translate({
  credentials: CREDENTIALS,
  projectId: CREDENTIALS.project_id
});

const translateText = async (text, targetLanguage) => {
  try {
      let [response] = await translate.translate(text, targetLanguage);
      return response; 
  } catch (error) {
      console.log(`Error at translateText --> ${error}`);
      return null;
  }
};

// ログダウンロードURL送信
app.post("/send-log-url", async (req, res) => {
  if (!req.body) {
    return;
  }

  const { roomId, logUrl } = req.body;
  try {
    db.init();
    db.insert("INSERT INTO log(roomId, logUrl) values(?, ?)", [roomId, logUrl]);
    db.close();

    return res.status(201).send();
  } catch (e) {
    return res.status(500).send({
      error: { code: 500, message: "Fail to post data" },
    });
  }
});

// ログダウンロードURL入手
app.get("/get-log-url", async (req, res) => {
  const roomId = req.query.roomId;

  try {
    db.init();
    const queryResult = await db.get("SELECT * FROM log WHERE roomId = ?", [
      roomId,
    ]);
    db.close();

    return res.status(200).send({ logUrl: queryResult.logUrl });
  } catch (e) {
    return res.status(404).send({
      error: { code: 404, message: "Failed on getting data from database" },
    });
  }
});

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
  cors: {
    origin: "*",
  },
  // serveClient: false,
  allowEIO3: true,
});

let rooms = [];
let phoneUsers = [];
let deviceUsers = [];

wsServer.on("connection", (socket) => {
  // イベント発火時のコンソール表示
  socket.onAny((event) => {
    console.log(`イベント: ${event}`);
  });

  // 接続切れの処理
  socket.on("disconnect", (reason) => {
    if (reason !== SERVER_DISCONNECT) {
      const currentSocketId = socket.id;

      const isPhoneUser =
        phoneUsers.find((phone) => phone.socketId === currentSocketId) !==
        undefined
          ? true
          : false;

      let targetPhone, targetDevice;
      if (isPhoneUser) {
        targetPhone = phoneUsers.find(
          (phone) => phone.socketId === currentSocketId
        );
        targetDevice = deviceUsers.find(
          (device) => device.uniqueId === targetPhone?.uniqueId
        );
      } else {
        targetDevice = deviceUsers.find(
          (device) => device.socketId === currentSocketId
        );
        targetPhone = phoneUsers.find(
          (phone) => phone.uniqueId === targetDevice?.uniqueId
        );
      }

      const roomId = targetPhone?.roomId;
      const uniqueId = targetPhone?.uniqueId;

      phoneUsers = phoneUsers.filter((phone) => phone.uniqueId !== uniqueId);
      deviceUsers = deviceUsers.filter(
        (device) => device.uniqueId !== uniqueId
      );

      if (targetPhone?.isHost) {
        phoneUsers = [];
        deviceUsers = [];
        rooms = rooms.filter((room) => room.roomId !== roomId);

        wsServer.emit("change-screen-leave");

        wsServer.emit("terminate-room-effect");

        wsServer.disconnectSockets();
      } else {
        try {
          if (targetDevice !== undefined) {
            console.log("Fire!!!!");
            const deviceSocket = wsServer.sockets.sockets.get(
              targetDevice.socketId
            );

            wsServer.emit("leave-room-effect", {
              userList: getUserList(phoneUsers, roomId),
            });

            deviceSocket.leave(roomId);
            socket.leave(roomId);
          }
        } catch (e) {
          emitErrorToSelf(socket, { errorMsg: "エラーが発生しました。" });
        }
      }
    }
  });

  // 本体起動時にデバイス情報を登録
  socket.on("entry", ({ uniqueId }) => {
    deviceUsers.push({
      socketId: socket.id,
      uniqueId,
      roomId: "",
    });
  });

  // ルーム情報取得
  socket.on("get-room", ({ roomId }, callback) => {
    const currentRoom = rooms.find((room) => room.roomId === roomId);
    if (!currentRoom) {
      emitErrorToSelf(socket, { errorMsg: "現在のルームを把握できません。" });
      socket.disconnect(true);
      return;
    }

    callback({
      title: currentRoom.title,
      userList: getUserList(phoneUsers, roomId),
    });
  });

  // ルーム作成
  socket.on(
    "create-room",
    ({ title, username, uniqueId, language }, callback) => {
      const roomId = generateRoomId(5);

      rooms.push({
        title: title,
        username: username,
        uniqueId: uniqueId,
        language: language,
        roomId: roomId,
      });

      phoneUsers.push({
        socketId: socket.id,
        uniqueId: uniqueId,
        roomId: roomId,
        username: username,
        language: language,
        isHost: true,
      });

      const targetDevice = getDeviceByUniqueId(deviceUsers, uniqueId);
      if (targetDevice !== undefined) {
        targetDevice.roomId = roomId;

        const deviceSocket = wsServer.sockets.sockets.get(
          targetDevice.socketId
        );
        deviceSocket.join(roomId);
      }

      socket.join(roomId);

      callback({
        roomId: roomId,
      });

      try {
        wsServer.in(roomId).emit("join-room-effect", {
          userList: getUserList(phoneUsers, roomId),
        });
      } catch {
        emitErrorToAll(wsServer, {
          roomId,
          errorMsg: "エラーが発生しました。",
        });
      }

      try {
        socket
          .to(targetDevice.socketId)
          .emit("change-screen-enter", { roomId, username });
      } catch {
        emitErrorToSelf(socket, {
          errorMsg: "本体デバイスを検索できませんでした。",
        });
        socket.disconnect(true);
      }

      console.log("rooms: ", rooms);
      console.log("phoneUsers: ", phoneUsers);
      console.log("deviceUsers: ", deviceUsers);
    }
  );

  //ルーム参加処理
  socket.on(
    "join-room",
    function ({ username, roomId, uniqueId, language }, callback) {
      phoneUsers.push({
        socketId: socket.id,
        uniqueId: uniqueId,
        roomId: roomId,
        username: username,
        language: language,
        isHost: false,
      });

      const targetDevice = getDeviceByUniqueId(deviceUsers, uniqueId);
      if (targetDevice !== undefined) {
        targetDevice.roomId = roomId;

        const deviceSocket = wsServer.sockets.sockets.get(
          targetDevice.socketId
        );
        deviceSocket.join(roomId);
      }

      socket.join(roomId);

      // FIXME: コールバックしないといけないかフロントのコードに合わせて削除してもいいと思う。
      callback({
        userList: getUserList(phoneUsers, roomId),
      });

      try {
        wsServer.emit("join-room-effect", {
          userList: getUserList(phoneUsers, roomId),
        });
      } catch (e) {
        emitErrorToAll(wsServer, {
          roomId,
          errorMsg: "エラーが発生しました。",
        });
      }

      try {
        socket
          .to(targetDevice.socketId)
          .emit("change-screen-enter", { roomId, username });
      } catch (e) {
        emitErrorToSelf(socket, {
          errorMsg: "本体デバイスを検索できませんでした。",
        });
        socket.disconnect(true);
      }

      console.log("rooms: ", rooms);
      console.log("phoneUsers: ", phoneUsers);
      console.log("deviceUsers: ", deviceUsers);
    }
  );

  // ルーム退出
  socket.on("leave-room", ({ uniqueId }) => {
    const targetDevice = getDeviceByUniqueId(deviceUsers, uniqueId);

    const phoneUser = phoneUsers.find((phone) => phone.uniqueId === uniqueId);

    if (phoneUser.isHost) {
      phoneUsers = [];
      deviceUsers = [];
      rooms = rooms.filter((room) => room.roomId !== phoneUser.roomId);

      wsServer.emit("change-screen-leave");

      wsServer.emit("terminate-room-effect");

      wsServer.disconnectSockets();
    } else {
      const removeIndex = phoneUsers.findIndex(
        (phone) => phone.uniqueId === uniqueId
      );
      phoneUsers.splice(removeIndex, 1);

      deviceUsers = deviceUsers.filter(
        (device) => device.uniqueId !== uniqueId
      );

      try {
        socket.to(targetDevice.socketId).emit("change-screen-leave");
      } catch (e) {
        emitErrorToSelf(socket, { errorMsg: "エラーが発生しました。" });
        socket.disconnect(true);
      }

      try {
        wsServer.emit("leave-room-effect", {
          userList: getUserList(phoneUsers, phoneUser.roomId),
        });

        if (targetDevice !== undefined) {
          const deviceSocket = wsServer.sockets.sockets.get(
            targetDevice.socketId
          );
          deviceSocket.leave(phoneUser.roomId);
        }

        socket.leave(phoneUser.roomId);
      } catch (e) {
        emitErrorToAll(wsServer, {
          roomId: phoneUser.roomId,
          errorMsg: "エラーが発生しました。",
        });
      }
    }
    console.log("rooms: ", rooms);
    console.log("phoneUsers: ", phoneUsers);
    console.log("deviceUsers: ", deviceUsers);
  });

  // ルーム解散
  socket.on("terminate-room", ({ roomId }) => {
    phoneUsers = phoneUsers.filter((phone) => phone.roomId !== roomId);
    deviceUsers = deviceUsers.filter((device) => device.roomId !== roomId);
    rooms = rooms.filter((room) => room.roomId !== roomId);

    try {
      wsServer.emit("terminate-room-effect");

      wsServer.emit("change-screen-leave");

      wsServer.disconnectSockets(roomId);
    } catch (e) {
      emitErrorToAll(wsServer, {
        roomId,
        errorMsg: "エラーが発生しました。",
      });
      socket.disconnect(true);
    }

    console.log("rooms: ", rooms);
    console.log("phoneUsers: ", phoneUsers);
    console.log("deviceUsers: ", deviceUsers);
  });

  // アクセシビリティ更新
  socket.on("change-accessibility", ({ fontSize_per, fontColor, uniqueId }) => {
    const targetDevice = getDeviceByUniqueId(deviceUsers, uniqueId);

    if (targetDevice !== undefined) {
      try {
        socket
          .to(targetDevice.socketId)
          .emit("change-accessibility-effect", { fontSize_per, fontColor });
      } catch (error) {
        emitErrorToSelf(socket, {
          errorMsg: "アクセシビリティ変更にエラーが発生しました。",
        });
      }
    }
  });

  // 議題変更
  socket.on("updated-title", ({ roomId, title }) => {
    const targetRoom = rooms.find((room) => room.roomId === roomId);

    if (targetRoom !== undefined) {
      try {
        wsServer.in(targetRoom.roomId).emit("updated-title-effect", { title });
      } catch (error) {
        emitErrorToAll(wsServer, {
          roomId: targetRoom.roomId,
          errorMsg: "タイトル更新にエラーが発生しました。",
        });
      }
    }
  });

  // モード切替
  socket.on("change-mode", ({ uniqueId, mode }) => {
    const targetDevice = getDeviceByUniqueId(deviceUsers, uniqueId);

    if (targetDevice !== undefined) {
      try {
        socket.to(targetDevice.socketId).emit("change-mode-effect", { mode });
      } catch (error) {
        emitErrorToSelf(socket, { errorMsg: "エラーが発生しました。" });
      }
    }
  });

  // 音声検知
  socket.on("send-detected-voice", (args) => {
    const targetDevice = getDeviceByUniqueId(deviceUsers, args.uniqueId);

    const chatText = args.comment;

    for(let i = 0; i < deviceUsers.length; i++) {
      let socketId = deviceUsers[i].socketId
      let uniqueId = deviceUsers[i].uniqueId
      let phoneUser = phoneUsers.find(user => user.uniqueId === uniqueId)
      let targetLanguage = phoneUser.language

      console.log(socketId)
      console.log(uniqueId)
      console.log(phoneUser)
      console.log(targetLanguage)

      translateText(chatText, targetLanguage)
      .then(async (result) => {
          console.log(i, " = ", socketId, " , ", result)
          socket.to(socketId).emit("emit-log", {
            username: targetDevice.username,
            comment: result,
            time: args.time,
          })
      }).catch((err) => {
          console.log(err);
      });
    }

    // try {
    //   wsServer.emit("emit-log", {
    //     username: targetDevice.username,
    //     comment: args.comment,
    //     time: args.time,
    //   });
    // } catch (e) {
    //   emitErrorToDevice(socket, {
    //     targetId: targetDevice.socketId,
    //     errorMsg: "エラーが発生しました。",
    //   });
    // }
  });

  // ジェスチャー検知
  socket.on("send-detected-gesture", ({ uniqueId, reaction, time }) => {
    const targetDevice = getDeviceByUniqueId(deviceUsers, uniqueId);

    try {
      wsServer.emit("emit-reaction", {
        username: targetDevice.username,
        reaction,
        time,
      });
    } catch (e) {
      emitErrorToDevice(socket, {
        targetId: targetDevice.socketId,
        errorMsg: "エラーが発生しました。",
      });
    }
  }); 

});

const handleListen = () => console.log(`Listening on port:${PORT}`);

httpServer.listen(PORT, "0.0.0.0", handleListen);
