"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.emitErrorToAll = emitErrorToAll;
exports.emitErrorToDevice = emitErrorToDevice;
exports.emitErrorToSelf = emitErrorToSelf;
exports.generateRoomId = generateRoomId;
exports.getDeviceByIPAddress = getDeviceByIPAddress;
exports.getUserList = getUserList;

// ルームIDの生成
function generateRoomId(idLength) {
  var CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var generatedId = "";

  for (var i = 0; i < idLength; i++) {
    generatedId += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
  }

  return generatedId;
} // ユーザリストの返還


function getUserList(users, roomId) {
  var usersInRoom = users.filter(function (user) {
    return user.roomId === roomId;
  });
  return usersInRoom.map(function (user) {
    return user["username"];
  });
} // デバイスの取得


function getDeviceByIPAddress(deviceUsers, ipaddress) {
  return deviceUsers.find(function (device) {
    return device.ipaddress === ipaddress;
  });
} // エラーエミット(全体向け)


function emitErrorToAll(socket, _ref) {
  var roomId = _ref.roomId,
      errorMsg = _ref.errorMsg;
  socket["in"](roomId).emit("error", {
    errorMsg: errorMsg
  });
} // エラーエミット(単体デバイス向け)


function emitErrorToDevice(socket, _ref2) {
  var targetId = _ref2.targetId,
      errorMsg = _ref2.errorMsg;
  socket.to(targetId).emit("error", {
    errorMsg: errorMsg
  });
} // エラーエミット(自身向け)


function emitErrorToSelf(socket, _ref3) {
  var errorMsg = _ref3.errorMsg;
  socket.emit("error", {
    errorMsg: errorMsg
  });
}
//# sourceMappingURL=utils.js.map