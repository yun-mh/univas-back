import http from "http";
import { Server } from "socket.io";
import express from "express";

const app = express();

const handleListen = () => console.log(`Listening on http://localhost:4000`);

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
  cors: {
    origin: "*",
  },
  // serveClient: false,
  allowEIO3: true,
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
let phoneUsers = []; // スマートフォン
let deviceUsers = []; // デバイス

wsServer.on("connection", (socket) => {
  // 本体起動時にデバイス情報を登録
  // socket.on("entry", () => {
  //   // デバイスユーザ配列に保存
  //   deviceUsers.push({
  //     socketId: socket.id,
  //     ipaddress: socket.client.conn.remoteAddress, //　IPアドレスか確認する必要あり。
  //     roomId: "",
  //   });
  // });
  // テスト用
  socket.on("entry", ({ ipaddress }) => {
    // デバイスユーザ配列に保存
    deviceUsers.push({
      socketId: socket.id,
      ipaddress, //　IPアドレスか確認する必要あり。
      roomId: "",
    });
  });

  // ルーム情報取得
  socket.on("get-room", ({ roomId }, callback) => {
    const currentRoom = rooms.find((room) => room.roomId === roomId);

    // ルーム内ユーザのusernameを取得
    const currentRoomUsers = phoneUsers.filter(
      (phone) => phone.roomId === roomId
    );
    const currentRoomUsersList = currentRoomUsers.map(function (user) {
      return user["username"];
    });

    callback({
      title: currentRoom.title,
      userList: currentRoomUsersList,
    });
  });

  // ルーム作成
  socket.on(
    "create-room",
    ({ title, username, ipaddress, language }, callback) => {
      const roomId = generateId(5);

      // ルーム配列に登録
      rooms.push({
        title: title,
        username: username,
        ipaddress: ipaddress,
        language: language,
        roomId: roomId,
      });

      // スマホユーザの登録
      phoneUsers.push({
        socketId: socket.id,
        ipaddress: ipaddress,
        roomId: roomId,
        username: username,
        language: language,
      });

      // デバイスユーザからターゲットデバイスを探し、アップデート
      const targetDevice = deviceUsers.find(
        (device) => device.ipaddress === ipaddress
      );
      if (targetDevice !== undefined) {
        targetDevice.roomId = roomId;
      }

      // スマホとデバイス共にルームに参加させる
      const deviceSocket = wsServer.sockets.sockets.get(targetDevice.socketId);
      deviceSocket.join(roomId);
      socket.join(roomId);

      callback({
        roomId: roomId,
      });

      // ユーザリストを取得
      const currentRoomUsers = phoneUsers.filter(
        (item) => item.roomId === roomId
      );

      const currentRoomUsersList = currentRoomUsers.map(function (user) {
        return user["username"];
      });

      try {
        wsServer
          .in(roomId)
          .emit("join-room-effect", { userList: currentRoomUsersList });
      } catch {
        emitError(wsServer, "all", roomId, "エラーが発生しました。");
      }

      try {
        socket
          .to(targetDevice.socketId)
          .emit("change-screen-enter", { roomId, username });
      } catch {
        emitError(
          socket,
          "single",
          targetDevice.socketId,
          "エラーが発生しました。"
        );
      }
    }
  );

  //ルーム参加処理
  socket.on(
    "join-room",
    function ({ username, roomId, ipaddress, language }, callback) {
      // スマホユーザの登録
      phoneUsers.push({
        socketId: socket.id,
        ipaddress: ipaddress,
        roomId: roomId,
        username: username,
        language: language,
      });

      // デバイスユーザからターゲットデバイスを探し、アップデート
      const targetDevice = deviceUsers.find(
        (device) => device.ipaddress === ipaddress
      );
      if (targetDevice !== undefined) {
        targetDevice.roomId = roomId;
      }

      // スマホとデバイス共にルームに参加させる
      const deviceSocket = wsServer.sockets.sockets.get(targetDevice.socketId);
      deviceSocket.join(roomId);
      socket.join(roomId);

      // ユーザリストを取得
      const currentRoomUsers = phoneUsers.filter(
        (user) => user.roomId === roomId
      );
      const currentRoomUsersList = currentRoomUsers.map(function (user) {
        return user["username"];
      });

      callback({
        userList: currentRoomUsersList,
      });

      //ユーザー参加通知のemit処理
      try {
        wsServer.emit("join-room-effect", {
          userList: currentRoomUsersList,
        });
      } catch (e) {
        emitError(wsServer, "all", roomId, "エラーが発生しました。");
      }

      //本体クライアントの入室時画面切り替え処理
      try {
        socket
          .to(targetDevice.socketId)
          .emit("change-screen-enter", { roomId, username });
      } catch (e) {
        emitError(
          socket,
          "single",
          targetDevice.socketId,
          "エラーが発生しました。"
        );
      }
    }
  );

  // ルーム退出
  socket.on("leave-room", ({ ipaddress }) => {
    // デバイスユーザからターゲットデバイスを探す
    const targetDevice = deviceUsers.find(
      (device) => device.ipaddress === ipaddress
    );

    // スマホユーザから該当ユーザを削除する
    const phoneUser = phoneUsers.find((item) => item.ipaddress === ipaddress);
    const removeIndex = phoneUsers.findIndex(
      (item) => item.ipaddress === ipaddress
    );
    phoneUsers.splice(removeIndex, 1);

    // デバイスユーザからデバイスを削除する
    deviceUsers = deviceUsers.filter(
      (device) => device.ipaddress !== ipaddress
    );

    // ルームのユーザ名の配列を取得する
    const currentRoomUsers = phoneUsers.filter(
      (user) => user.roomId === phoneUser.roomId
    );
    const currentRoomUsersList = currentRoomUsers.map(function (user) {
      return user["username"];
    });

    try {
      socket.to(targetDevice.socketId).emit("change-screen-leave");
    } catch (e) {
      emitError(socket, "single", phoneUser.socketId, "エラーが発生しました。");
    }

    // 退出か自動解散か判断
    if (currentRoomUsers.length !== 0) {
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
    } else {
      const removeIndex = rooms.findIndex(
        (room) => room.roomId === phoneUser.roomId
      );
      rooms.splice(removeIndex, 1);

      wsServer.disconnectSockets(phoneUser.roomId);
    }
  });

  // ルーム解散
  socket.on("terminate-room", ({ roomId }) => {
    // スマホユーザから該当ユーザを削除する
    phoneUsers = phoneUsers.filter((user) => user.roomId !== roomId);

    // デバイスユーザからデバイスを削除する
    deviceUsers = deviceUsers.filter((device) => device.roomId !== roomId);

    // ルームを削除する
    const removeIndex = rooms.findIndex((item) => item.roomId === roomId);
    rooms.splice(removeIndex, 1);

    try {
      wsServer.emit("terminate-room-effect");

      wsServer.emit("change-screen-leave");

      wsServer.disconnectSockets(roomId);
    } catch (e) {
      emitError(wsServer, "all", roomId, "エラーが発生した。");
    }
  });

  // アクセシビリティ更新
  socket.on(
    "change-accessibility",
    ({ fontSize_per, fontColor, ipaddress }) => {
      // 引数のIPアドレスでデバイスを識別
      const targetDevice = deviceUsers.find(
        (device) => device.ipaddress === ipaddress
      );

      // アクセシビリティ更新通知
      if (targetDevice !== undefined) {
        try {
          socket
            .to(targetDevice.socketId)
            .emit("change-accessibility-effect", { fontSize_per, fontColor });
        } catch (e) {
          emitError(
            socket,
            "single",
            targetDevice.socketId,
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
    // 引数のIPアドレスでデバイスを識別
    const targetDevice = deviceUsers.find(
      (device) => device.ipaddress === ipaddress
    );

    if (targetDevice !== undefined) {
      // モード切替通知
      try {
        socket.to(targetDevice.socketId).emit("change-mode-effect", { mode });
      } catch (e) {
        emitError(
          socket,
          "single",
          targetDevice.socketId,
          "エラーが発生しました。"
        );
      }
    }
  });
});

httpServer.listen(4000, handleListen);
