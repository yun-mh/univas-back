"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _http = _interopRequireDefault(require("http"));

var _socket = require("socket.io");

var _express = _interopRequireDefault(require("express"));

var _v = require("@google-cloud/translate/build/src/v2");

var _database = require("./database");

var _constants = require("./constants");

var _utils = require("./utils");

require("dotenv").config();

var PORT = process.env.PORT || 4000;
var app = (0, _express["default"])();
app.use(_express["default"].json());
app.use(_express["default"].urlencoded({
  extended: true
}));
var db = new _database.Database();
var translate = new _v.Translate({
  credentials: {
    type: "service_account",
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.TRANSLATOR_KEY_ID,
    private_key: process.env.TRANSLATOR_KEY,
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.CLIENT_CERT
  },
  projectId: process.env.PROJECT_ID
}); // 翻訳処理

var translateText = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(text, targetLanguage) {
    var _yield$translate$tran, _yield$translate$tran2, response;

    return _regenerator["default"].wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;
            _context.next = 3;
            return translate.translate(text, targetLanguage);

          case 3:
            _yield$translate$tran = _context.sent;
            _yield$translate$tran2 = (0, _slicedToArray2["default"])(_yield$translate$tran, 1);
            response = _yield$translate$tran2[0];
            return _context.abrupt("return", response);

          case 9:
            _context.prev = 9;
            _context.t0 = _context["catch"](0);
            console.log("Error at translateText --> ".concat(_context.t0));
            return _context.abrupt("return", null);

          case 13:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, null, [[0, 9]]);
  }));

  return function translateText(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}(); // ログダウンロードURL送信


app.post("/send-log-url", /*#__PURE__*/function () {
  var _ref2 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2(req, res) {
    var _req$body, roomId, logUrl;

    return _regenerator["default"].wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (req.body) {
              _context2.next = 2;
              break;
            }

            return _context2.abrupt("return");

          case 2:
            _req$body = req.body, roomId = _req$body.roomId, logUrl = _req$body.logUrl;
            _context2.prev = 3;
            db.init();
            db.insert("INSERT INTO log(roomId, logUrl) values(?, ?)", [roomId, logUrl]);
            db.close();
            return _context2.abrupt("return", res.status(201).send());

          case 10:
            _context2.prev = 10;
            _context2.t0 = _context2["catch"](3);
            return _context2.abrupt("return", res.status(500).send({
              error: {
                code: 500,
                message: "Fail to post data"
              }
            }));

          case 13:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, null, [[3, 10]]);
  }));

  return function (_x3, _x4) {
    return _ref2.apply(this, arguments);
  };
}()); // ログダウンロードURL入手

app.get("/get-log-url", /*#__PURE__*/function () {
  var _ref3 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee3(req, res) {
    var roomId, queryResult;
    return _regenerator["default"].wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            roomId = req.query.roomId;
            _context3.prev = 1;
            db.init();
            _context3.next = 5;
            return db.get("SELECT * FROM log WHERE roomId = ?", [roomId]);

          case 5:
            queryResult = _context3.sent;
            db.close();
            return _context3.abrupt("return", res.status(200).send({
              logUrl: queryResult.logUrl
            }));

          case 10:
            _context3.prev = 10;
            _context3.t0 = _context3["catch"](1);
            return _context3.abrupt("return", res.status(404).send({
              error: {
                code: 404,
                message: "Failed on getting data from database"
              }
            }));

          case 13:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3, null, [[1, 10]]);
  }));

  return function (_x5, _x6) {
    return _ref3.apply(this, arguments);
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

          return device.uniqueId === ((_targetPhone = targetPhone) === null || _targetPhone === void 0 ? void 0 : _targetPhone.uniqueId);
        });
      } else {
        targetDevice = deviceUsers.find(function (device) {
          return device.socketId === currentSocketId;
        });
        targetPhone = phoneUsers.find(function (phone) {
          var _targetDevice;

          return phone.uniqueId === ((_targetDevice = targetDevice) === null || _targetDevice === void 0 ? void 0 : _targetDevice.uniqueId);
        });
      }

      var roomId = (_targetPhone2 = targetPhone) === null || _targetPhone2 === void 0 ? void 0 : _targetPhone2.roomId;
      var uniqueId = (_targetPhone3 = targetPhone) === null || _targetPhone3 === void 0 ? void 0 : _targetPhone3.uniqueId;
      phoneUsers = phoneUsers.filter(function (phone) {
        return phone.uniqueId !== uniqueId;
      });
      deviceUsers = deviceUsers.filter(function (device) {
        return device.uniqueId !== uniqueId;
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
            console.log("Fire!!!!");
            var deviceSocket = wsServer.sockets.sockets.get(targetDevice.socketId);
            wsServer.emit("leave-room-effect", {
              userList: (0, _utils.getUserList)(phoneUsers, roomId)
            });
            deviceSocket.leave(roomId);
            socket.leave(roomId);
          }
        } catch (e) {
          (0, _utils.emitErrorToSelf)(socket, {
            errorMsg: "エラーが発生しました。"
          });
        }
      }
    }
  }); // 本体起動時にデバイス情報を登録

  socket.on("entry", function (_ref4) {
    var uniqueId = _ref4.uniqueId;
    console.log(uniqueId);
    deviceUsers.push({
      socketId: socket.id,
      uniqueId: uniqueId,
      roomId: ""
    });
    console.log(deviceUsers);
  }); // ルーム情報取得

  socket.on("get-room", function (_ref5, callback) {
    var roomId = _ref5.roomId;
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

  socket.on("create-room", function (_ref6, callback) {
    var title = _ref6.title,
        username = _ref6.username,
        uniqueId = _ref6.uniqueId,
        language = _ref6.language;
    var roomId = (0, _utils.generateRoomId)(5);
    rooms.push({
      title: title,
      username: username,
      uniqueId: uniqueId,
      language: language,
      roomId: roomId
    });
    phoneUsers.push({
      socketId: socket.id,
      uniqueId: uniqueId,
      roomId: roomId,
      username: username,
      language: language,
      isHost: true
    });
    var targetDevice = (0, _utils.getDeviceByUniqueId)(deviceUsers, uniqueId);

    if (targetDevice !== undefined) {
      console.log("targetDevice: ", targetDevice);
      targetDevice.roomId = roomId;
      var deviceSocket = wsServer.sockets.sockets.get(targetDevice.socketId);
      console.log("deviceSocket: ", deviceSocket);
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

  socket.on("join-room", function (_ref7, callback) {
    var username = _ref7.username,
        roomId = _ref7.roomId,
        uniqueId = _ref7.uniqueId,
        language = _ref7.language;
    phoneUsers.push({
      socketId: socket.id,
      uniqueId: uniqueId,
      roomId: roomId,
      username: username,
      language: language,
      isHost: false
    });
    var targetDevice = (0, _utils.getDeviceByUniqueId)(deviceUsers, uniqueId);

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

  socket.on("leave-room", function (_ref8) {
    var uniqueId = _ref8.uniqueId;
    var targetDevice = (0, _utils.getDeviceByUniqueId)(deviceUsers, uniqueId);
    var phoneUser = phoneUsers.find(function (phone) {
      return phone.uniqueId === uniqueId;
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
        return phone.uniqueId === uniqueId;
      });
      phoneUsers.splice(removeIndex, 1);
      deviceUsers = deviceUsers.filter(function (device) {
        return device.uniqueId !== uniqueId;
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

  socket.on("terminate-room", function (_ref9) {
    var roomId = _ref9.roomId;
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

  socket.on("change-accessibility", function (_ref10) {
    var fontSize_per = _ref10.fontSize_per,
        fontColor = _ref10.fontColor,
        uniqueId = _ref10.uniqueId;
    var targetDevice = (0, _utils.getDeviceByUniqueId)(deviceUsers, uniqueId);

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

  socket.on("updated-title", function (_ref11) {
    var roomId = _ref11.roomId,
        title = _ref11.title;
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

  socket.on("change-mode", function (_ref12) {
    var uniqueId = _ref12.uniqueId,
        mode = _ref12.mode;
    var targetDevice = (0, _utils.getDeviceByUniqueId)(deviceUsers, uniqueId);

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
  }); // 音声検知

  socket.on("send-detected-voice", function (_ref13) {
    var uniqueId = _ref13.uniqueId,
        comment = _ref13.comment,
        time = _ref13.time;
    var targetDevice = (0, _utils.getDeviceByUniqueId)(deviceUsers, uniqueId);

    var _loop = function _loop(i) {
      var socketId = deviceUsers[i].socketId;
      var deviceUniqueId = deviceUsers[i].uniqueId;
      var phoneUser = phoneUsers.find(function (user) {
        return user.uniqueId === deviceUniqueId;
      });
      var targetLanguage = phoneUser.language;
      translateText(comment, targetLanguage).then( /*#__PURE__*/function () {
        var _ref14 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4(result) {
          return _regenerator["default"].wrap(function _callee4$(_context4) {
            while (1) {
              switch (_context4.prev = _context4.next) {
                case 0:
                  console.log(i, " = ", socketId, " , ", result);
                  socket.to(socketId).emit("emit-log", {
                    username: targetDevice.username,
                    comment: result,
                    time: time
                  });

                case 2:
                case "end":
                  return _context4.stop();
              }
            }
          }, _callee4);
        }));

        return function (_x7) {
          return _ref14.apply(this, arguments);
        };
      }())["catch"](function (err) {
        console.log(err);
      });
    };

    for (var i = 0; i < deviceUsers.length; i++) {
      _loop(i);
    }
  }); // ジェスチャー検知

  socket.on("send-detected-gesture", function (_ref15) {
    var uniqueId = _ref15.uniqueId,
        reaction = _ref15.reaction,
        time = _ref15.time;
    var targetDevice = (0, _utils.getDeviceByUniqueId)(deviceUsers, uniqueId);

    try {
      wsServer.emit("emit-reaction", {
        username: targetDevice.username,
        reaction: reaction,
        time: time
      });
    } catch (e) {
      (0, _utils.emitErrorToDevice)(socket, {
        targetId: targetDevice.socketId,
        errorMsg: "エラーが発生しました。"
      });
    }
  });
});

var handleListen = function handleListen() {
  return console.log("Listening on port:".concat(PORT));
};

httpServer.listen(PORT, "0.0.0.0", handleListen);
//# sourceMappingURL=server.js.map