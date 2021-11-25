"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _http = _interopRequireDefault(require("http"));

var _socket = require("socket.io");

var _express = _interopRequireDefault(require("express"));

var _database = require("./database");

var _constants = require("./constants");

var _utils = require("./utils");

var app = (0, _express["default"])();
app.use(_express["default"].json());
app.use(_express["default"].urlencoded({
  extended: true
}));
var db = new _database.Database(); // ログダウンロードURL送信

app.post("/send-log-url", /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(req, res) {
    var _req$body, roomId, logUrl;

    return _regenerator["default"].wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (req.body) {
              _context.next = 2;
              break;
            }

            return _context.abrupt("return");

          case 2:
            _req$body = req.body, roomId = _req$body.roomId, logUrl = _req$body.logUrl;
            _context.prev = 3;
            db.init();
            db.insert("INSERT INTO log(roomId, logUrl) values(?, ?)", [roomId, logUrl]);
            db.close();
            return _context.abrupt("return", res.status(201).send());

          case 10:
            _context.prev = 10;
            _context.t0 = _context["catch"](3);
            return _context.abrupt("return", res.status(500).send({
              error: {
                code: 500,
                message: "Fail to post data"
              }
            }));

          case 13:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, null, [[3, 10]]);
  }));

  return function (_x, _x2) {
    return _ref.apply(this, arguments);
  };
}()); // ログダウンロードURL入手

app.get("/get-log-url", /*#__PURE__*/function () {
  var _ref2 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2(req, res) {
    var roomId, queryResult;
    return _regenerator["default"].wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            roomId = req.query.roomId;
            _context2.prev = 1;
            db.init();
            _context2.next = 5;
            return db.get("SELECT * FROM log WHERE roomId = ?", [roomId]);

          case 5:
            queryResult = _context2.sent;
            db.close();
            return _context2.abrupt("return", res.status(200).send({
              logUrl: queryResult.logUrl
            }));

          case 10:
            _context2.prev = 10;
            _context2.t0 = _context2["catch"](1);
            return _context2.abrupt("return", res.status(404).send({
              error: {
                code: 404,
                message: "Failed on getting data from database"
              }
            }));

          case 13:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, null, [[1, 10]]);
  }));

  return function (_x3, _x4) {
    return _ref2.apply(this, arguments);
  };
}());

var httpServer = _http["default"].createServer(app);

var wsServer = new _socket.Server(httpServer, {
  cors: {
    origin: "*"
  },
  // serveClient: false,
  allowEIO3: true
});
var rooms = [];
var phoneUsers = [];
var deviceUsers = [];
wsServer.on("connection", function (socket) {
  // イベント発火時のコンソール表示
  socket.onAny(function (event) {
    console.log("\u30A4\u30D9\u30F3\u30C8: ".concat(event));
  }); // 接続切れの処理

  socket.on("disconnect", function (reason) {
    if (reason !== _constants.SERVER_DISCONNECT) {
      var _targetPhone2, _targetPhone3, _targetPhone4;

      var currentSocketId = socket.id;
      var isPhoneUser = phoneUsers.find(function (phone) {
        return phone.socketId === currentSocketId;
      }) !== undefined ? true : false;
      var targetPhone, targetDevice;

      if (isPhoneUser) {
        targetPhone = phoneUsers.find(function (phone) {
          return phone.socketId === currentSocketId;
        });
        targetDevice = deviceUsers.find(function (device) {
          var _targetPhone;

          return device.ipaddress === ((_targetPhone = targetPhone) === null || _targetPhone === void 0 ? void 0 : _targetPhone.ipaddress);
        });
      } else {
        targetDevice = deviceUsers.find(function (device) {
          return device.socketId === currentSocketId;
        });
        targetPhone = phoneUsers.find(function (phone) {
          var _targetDevice;

          return phone.ipaddress === ((_targetDevice = targetDevice) === null || _targetDevice === void 0 ? void 0 : _targetDevice.ipaddress);
        });
      }

      var roomId = (_targetPhone2 = targetPhone) === null || _targetPhone2 === void 0 ? void 0 : _targetPhone2.roomId;
      var ipaddress = (_targetPhone3 = targetPhone) === null || _targetPhone3 === void 0 ? void 0 : _targetPhone3.ipaddress;
      phoneUsers = phoneUsers.filter(function (phone) {
        return phone.ipaddress !== ipaddress;
      });
      deviceUsers = deviceUsers.filter(function (device) {
        return device.ipaddress !== ipaddress;
      });

      if ((_targetPhone4 = targetPhone) !== null && _targetPhone4 !== void 0 && _targetPhone4.isHost) {
        phoneUsers = [];
        deviceUsers = [];
        rooms = rooms.filter(function (room) {
          return room.roomId !== roomId;
        });
        wsServer.emit("change-screen-leave");
        wsServer.emit("terminate-room-effect");
        wsServer.disconnectSockets();
      } else {
        try {
          if (targetDevice !== undefined) {
            var deviceSocket = wsServer.sockets.sockets.get(targetDevice.socketId);
            deviceSocket.leave(roomId);
            socket.leave(roomId);
            wsServer.emit("leave-room-effect", {
              userList: (0, _utils.getUserList)(phoneUsers, roomId)
            });
          }
        } catch (e) {
          (0, _utils.emitErrorToSelf)(socket, {
            errorMsg: "エラーが発生しました。"
          });
        }
      }

      console.log("rooms: ", rooms);
      console.log("phoneUsers: ", phoneUsers);
      console.log("deviceUsers: ", deviceUsers);
    }
  }); // 本体起動時にデバイス情報を登録

  socket.on("entry", function (args) {
    deviceUsers.push({
      socketId: socket.id,
      ipaddress: args.ipaddress,
      roomId: ""
    }); // ルーム情報取得

    socket.on("get-room", function (_ref3, callback) {
      var roomId = _ref3.roomId;
      var currentRoom = rooms.find(function (room) {
        return room.roomId === roomId;
      });

      if (!currentRoom) {
        (0, _utils.emitErrorToSelf)(socket, {
          errorMsg: "現在のルームを把握できません。"
        });
        socket.disconnect(true);
        return;
      }

      callback({
        title: currentRoom.title,
        userList: (0, _utils.getUserList)(phoneUsers, roomId)
      });
    }); // ルーム作成

    socket.on("create-room", function (_ref4, callback) {
      var title = _ref4.title,
          username = _ref4.username,
          ipaddress = _ref4.ipaddress,
          language = _ref4.language;
      var roomId = (0, _utils.generateRoomId)(5);
      rooms.push({
        title: title,
        username: username,
        ipaddress: ipaddress,
        language: language,
        roomId: roomId
      });
      phoneUsers.push({
        socketId: socket.id,
        ipaddress: ipaddress,
        roomId: roomId,
        username: username,
        language: language,
        isHost: true
      });
      var targetDevice = (0, _utils.getDeviceByIPAddress)(deviceUsers, ipaddress);

      if (targetDevice !== undefined) {
        targetDevice.roomId = roomId;
        var deviceSocket = wsServer.sockets.sockets.get(targetDevice.socketId);
        deviceSocket.join(roomId);
      }

      socket.join(roomId);
      callback({
        roomId: roomId
      });

      try {
        wsServer["in"](roomId).emit("join-room-effect", {
          userList: (0, _utils.getUserList)(phoneUsers, roomId)
        });
      } catch (_unused) {
        (0, _utils.emitErrorToAll)(wsServer, {
          roomId: roomId,
          errorMsg: "エラーが発生しました。"
        });
      }

      try {
        socket.to(targetDevice.socketId).emit("change-screen-enter", {
          roomId: roomId,
          username: username
        });
      } catch (_unused2) {
        (0, _utils.emitErrorToSelf)(socket, {
          errorMsg: "本体デバイスを検索できませんでした。"
        });
        socket.disconnect(true);
      }

      console.log("rooms: ", rooms);
      console.log("phoneUsers: ", phoneUsers);
      console.log("deviceUsers: ", deviceUsers);
    }); //ルーム参加処理

    socket.on("join-room", function (_ref5, callback) {
      var username = _ref5.username,
          roomId = _ref5.roomId,
          ipaddress = _ref5.ipaddress,
          language = _ref5.language;
      phoneUsers.push({
        socketId: socket.id,
        ipaddress: ipaddress,
        roomId: roomId,
        username: username,
        language: language,
        isHost: false
      });
      var targetDevice = (0, _utils.getDeviceByIPAddress)(deviceUsers, ipaddress);

      if (targetDevice !== undefined) {
        targetDevice.roomId = roomId;
        var deviceSocket = wsServer.sockets.sockets.get(targetDevice.socketId);
        deviceSocket.join(roomId);
      }

      socket.join(roomId); // FIXME: コールバックしないといけないかフロントのコードに合わせて削除してもいいと思う。

      callback({
        userList: (0, _utils.getUserList)(phoneUsers, roomId)
      });

      try {
        wsServer.emit("join-room-effect", {
          userList: (0, _utils.getUserList)(phoneUsers, roomId)
        });
      } catch (e) {
        (0, _utils.emitErrorToAll)(wsServer, {
          roomId: roomId,
          errorMsg: "エラーが発生しました。"
        });
      }

      try {
        socket.to(targetDevice.socketId).emit("change-screen-enter", {
          roomId: roomId,
          username: username
        });
      } catch (e) {
        (0, _utils.emitErrorToSelf)(socket, {
          errorMsg: "本体デバイスを検索できませんでした。"
        });
        socket.disconnect(true);
      }

      console.log("rooms: ", rooms);
      console.log("phoneUsers: ", phoneUsers);
      console.log("deviceUsers: ", deviceUsers);
    }); // ルーム退出

    socket.on("leave-room", function (_ref6) {
      var ipaddress = _ref6.ipaddress;
      var targetDevice = (0, _utils.getDeviceByIPAddress)(deviceUsers, ipaddress);
      var phoneUser = phoneUsers.find(function (phone) {
        return phone.ipaddress === ipaddress;
      });

      if (phoneUser.isHost) {
        phoneUsers = [];
        deviceUsers = [];
        rooms = rooms.filter(function (room) {
          return room.roomId !== phoneUser.roomId;
        });
        wsServer.emit("change-screen-leave");
        wsServer.emit("terminate-room-effect");
        wsServer.disconnectSockets();
      } else {
        var removeIndex = phoneUsers.findIndex(function (phone) {
          return phone.ipaddress === ipaddress;
        });
        phoneUsers.splice(removeIndex, 1);
        deviceUsers = deviceUsers.filter(function (device) {
          return device.ipaddress !== ipaddress;
        });

        try {
          socket.to(targetDevice.socketId).emit("change-screen-leave");
        } catch (e) {
          (0, _utils.emitErrorToSelf)(socket, {
            errorMsg: "エラーが発生しました。"
          });
          socket.disconnect(true);
        }

        try {
          wsServer.emit("leave-room-effect", {
            userList: (0, _utils.getUserList)(phoneUsers, phoneUser.roomId)
          });

          if (targetDevice !== undefined) {
            var deviceSocket = wsServer.sockets.sockets.get(targetDevice.socketId);
            deviceSocket.leave(phoneUser.roomId);
          }

          socket.leave(phoneUser.roomId);
        } catch (e) {
          (0, _utils.emitErrorToAll)(wsServer, {
            roomId: phoneUser.roomId,
            errorMsg: "エラーが発生しました。"
          });
        }
      }

      console.log("rooms: ", rooms);
      console.log("phoneUsers: ", phoneUsers);
      console.log("deviceUsers: ", deviceUsers);
    }); // ルーム解散

    socket.on("terminate-room", function (_ref7) {
      var roomId = _ref7.roomId;
      phoneUsers = phoneUsers.filter(function (phone) {
        return phone.roomId !== roomId;
      });
      deviceUsers = deviceUsers.filter(function (device) {
        return device.roomId !== roomId;
      });
      rooms = rooms.filter(function (room) {
        return room.roomId !== roomId;
      });

      try {
        wsServer.emit("terminate-room-effect");
        wsServer.emit("change-screen-leave");
        wsServer.disconnectSockets(roomId);
      } catch (e) {
        (0, _utils.emitErrorToAll)(wsServer, {
          roomId: roomId,
          errorMsg: "エラーが発生しました。"
        });
        socket.disconnect(true);
      }

      console.log("rooms: ", rooms);
      console.log("phoneUsers: ", phoneUsers);
      console.log("deviceUsers: ", deviceUsers);
    }); // アクセシビリティ更新

    socket.on("change-accessibility", function (_ref8) {
      var fontSize_per = _ref8.fontSize_per,
          fontColor = _ref8.fontColor,
          ipaddress = _ref8.ipaddress;
      var targetDevice = (0, _utils.getDeviceByIPAddress)(deviceUsers, ipaddress);

      if (targetDevice !== undefined) {
        try {
          socket.to(targetDevice.socketId).emit("change-accessibility-effect", {
            fontSize_per: fontSize_per,
            fontColor: fontColor
          });
        } catch (error) {
          (0, _utils.emitErrorToSelf)(socket, {
            errorMsg: "アクセシビリティ変更にエラーが発生しました。"
          });
        }
      }
    }); // 議題変更

    socket.on("updated-title", function (_ref9) {
      var roomId = _ref9.roomId,
          title = _ref9.title;
      var targetRoom = rooms.find(function (room) {
        return room.roomId === roomId;
      });

      if (targetRoom !== undefined) {
        try {
          wsServer["in"](targetRoom.roomId).emit("updated-title-effect", {
            title: title
          });
        } catch (error) {
          (0, _utils.emitErrorToAll)(wsServer, {
            roomId: targetRoom.roomId,
            errorMsg: "タイトル更新にエラーが発生しました。"
          });
        }
      }
    }); // モード切替

    socket.on("change-mode", function (_ref10) {
      var ipaddress = _ref10.ipaddress,
          mode = _ref10.mode;
      var targetDevice = (0, _utils.getDeviceByIPAddress)(deviceUsers, ipaddress);

      if (targetDevice !== undefined) {
        try {
          socket.to(targetDevice.socketId).emit("change-mode-effect", {
            mode: mode
          });
        } catch (error) {
          (0, _utils.emitErrorToSelf)(socket, {
            errorMsg: "エラーが発生しました。"
          });
        }
      }
    }); //AI用

    socket.on("send-detected-voice", function (args) {
      var targetDevice = (0, _utils.getDeviceByIPAddress)(deviceUsers, socket.client.conn.remoteAddress);

      try {
        wsServer.emit("emit-log", {
          username: targetDevice.username,
          comment: args.comment,
          time: args.time
        });
      } catch (e) {
        (0, _utils.emitErrorToDevice)(socket, {
          targetId: targetDevice.socketId,
          errorMsg: "エラーが発生しました。"
        });
      }
    });
    socket.on("send-detected-gesture", function (args) {
      var targetDevice = (0, _utils.getDeviceByIPAddress)(deviceUsers, socket.client.conn.remoteAddress);

      try {
        wsServer.emit("emit-reaction", {
          username: targetDevice.username,
          reaction: args.reaction,
          time: args.time
        });
      } catch (e) {
        (0, _utils.emitErrorToDevice)(socket, {
          targetId: targetDevice.socketId,
          errorMsg: "エラーが発生しました。"
        });
      }
    });
  });
});

var handleListen = function handleListen() {
  return console.log("Listening on http://localhost:4000");
};

httpServer.listen(4000, "0.0.0.0", handleListen);
//# sourceMappingURL=server.js.map