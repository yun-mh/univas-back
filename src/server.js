import http from "http";
import { Server } from "socket.io";
import express from "express";

import { Database } from "./database";
import {
  emitErrorToSelf,
  emitErrorToDevice,
  emitErrorToAll,
  generateRoomId,
  getUserList,
  getDeviceByIPAddress,
} from "./utils";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new Database();

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
  // TODO: 最終的には消す
  socket.onAny((event) => {
    console.log(`イベント: ${event}`);
  });

  // 本体起動時にデバイス情報を登録
  socket.on("entry", () => {
    deviceUsers.push({
      socketId: socket.id,
      ipaddress: socket.handshake.address,
      roomId: "",
    });
  });

  socket.on("disconnect", () => {
    const ipaddress = socket.handshake.address;

    const phoneUser = phoneUsers.find((item) => item.ipaddress === ipaddress);
    const roomId = phoneUser.roomId;

    const newPhoneUsers = phoneUsers.filter(
      (item) => item.ipaddress === ipaddress
    );
    phoneUsers = newPhoneUsers;

    const newDeviceUsers = deviceUsers.filter(
      (item) => item.ipaddress === ipaddress
    );
    deviceUsers = newDeviceUsers;

    // ユーザリストを取得
    const currentRoomUsers = phoneUsers.filter(
      (item) => item.roomId === roomId
    );

    const currentRoomUsersList = currentRoomUsers.map(function (user) {
      return user["username"];
    });

    // 退出か自動解散か判断
    if (phoneUser.isAdmin) {
      const removeIndex = rooms.findIndex(
        (room) => room.roomId === phoneUser.roomId
      );
      rooms.splice(removeIndex, 1);

      wsServer.disconnectSockets(phoneUser.roomId);
    } else {
      try {
        wsServer.emit("leave-room-effect", { userList: currentRoomUsersList });

        // スマホとデバイス共にルームに退出させる
        const deviceSocket = wsServer.sockets.sockets.get(
          targetDevice.socketId
        );
        deviceSocket.leave(phoneUser.roomId);
        socket.leave(phoneUser.roomId);
      } catch (e) {
        emitError(wsServer, "all", phoneUser.roomId, "エラーが発生しました。");
      }
    }
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
    ({ title, username, ipaddress, language }, callback) => {
      const roomId = generateRoomId(5);

      rooms.push({
        title: title,
        username: username,
        ipaddress: ipaddress,
        language: language,
        roomId: roomId,
        isAdmin: true,
      });

      phoneUsers.push({
        socketId: socket.id,
        ipaddress: ipaddress,
        roomId: roomId,
        username: username,
        language: language,
      });

      // デバイスユーザからターゲットデバイスを探し、参加処理を行う
      const targetDevice = getDeviceByIPAddress(deviceUsers, ipaddress);
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
    }
  );

  //ルーム参加処理
  socket.on(
    "join-room",
    function ({ username, roomId, ipaddress, language }, callback) {
      phoneUsers.push({
        socketId: socket.id,
        ipaddress: ipaddress,
        roomId: roomId,
        username: username,
        language: language,
        isAdmin: false,
      });

      // デバイスユーザからターゲットデバイスを探し、参加の処理を行う
      const targetDevice = getDeviceByIPAddress(deviceUsers, ipaddress);
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
    }
  );

  // ルーム退出
  socket.on("leave-room", ({ ipaddress }) => {
    const targetDevice = getDeviceByIPAddress(deviceUsers, ipaddress);

    // FIXME: クリスくんの作業でコードの変更が行われる可能性あり
    const phoneUser = phoneUsers.find((user) => user.ipaddress === ipaddress);
    const removeIndex = phoneUsers.findIndex(
      (user) => user.ipaddress === ipaddress
    );
    phoneUsers.splice(removeIndex, 1);

    deviceUsers = deviceUsers.filter(
      (device) => device.ipaddress !== ipaddress
    );

    const currentRoomUsers = phoneUsers.filter(
      (user) => user.roomId === phoneUser.roomId
    );

    try {
      socket.to(targetDevice.socketId).emit("change-screen-leave");
    } catch (e) {
      emitErrorToSelf(socket, { errorMsg: "エラーが発生しました。" });
      socket.disconnect(true);
    }

    // 退出か自動解散か判断
    if (phoneUser.isAdmin) {
      const removeIndex = rooms.findIndex(
        (room) => room.roomId === phoneUser.roomId
      );
      rooms.splice(removeIndex, 1);

      wsServer.disconnectSockets(phoneUser.roomId);
    } else {
      try {
        wsServer.emit("leave-room-effect", {
          userList: getUserList(phoneUsers, phoneUser.roomId),
        });

        // スマホとデバイス共にルームに退出させる
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
  });

  // ルーム解散
  socket.on("terminate-room", ({ roomId }) => {
    phoneUsers = phoneUsers.filter((user) => user.roomId !== roomId);
    deviceUsers = deviceUsers.filter((device) => device.roomId !== roomId);
    rooms = rooms.filter((room) => room.roomId !== roomId);

    try {
      wsServer.emit("terminate-room-effect");

      wsServer.emit("change-screen-leave");

      wsServer.disconnectSockets(roomId);
    } catch (e) {
      emitErrorToAll(wsServer, { roomId, errorMsg: "エラーが発生しました。" });
      socket.disconnect(true);
    }
  });

  // アクセシビリティ更新
  socket.on(
    "change-accessibility",
    ({ fontSize_per, fontColor, ipaddress }) => {
      const targetDevice = getDeviceByIPAddress(deviceUsers, ipaddress);

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
    }
  );

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
  socket.on("change-mode", ({ ipaddress, mode }) => {
    const targetDevice = getDeviceByIPAddress(deviceUsers, ipaddress);

    if (targetDevice !== undefined) {
      try {
        socket.to(targetDevice.socketId).emit("change-mode-effect", { mode });
      } catch (error) {
        emitErrorToSelf(socket, { errorMsg: "エラーが発生しました。" });
      }
    }
  });

  //下記AIテスト用
  socket.on("send-detected-voice", function (args) {
    let target = users.find((item) => item.ipaddress === "192.168.2.100"); //IPアドレスはAI側から受け取る？

    try {
      wsServer.emit("emit-log", {
        username: user.username,
        comment: args.comment,
        time: args.time,
      });
    } catch (e) {
      emitErrorToDevice(socket, {
        targetId: target.socketId,
        errorMsg: "エラーが発生しました。",
      });
    }
  });

  socket.on("send-detected-gesture", function (args) {
    let user = users.find((item) => item.ipaddress === "192.168.2.100");

    try {
      wsServer.emit("emit-reaction", {
        username: user.username,
        reaction: args.reaction,
        time: args.time,
      });
    } catch (e) {
      emitErrorToDevice(socket, {
        targetId: target.socketId,
        errorMsg: "エラーが発生しました。",
      });
    }
  });
});

const handleListen = () => console.log(`Listening on http://localhost:4000`);

httpServer.listen(4000, "0.0.0.0", handleListen);
