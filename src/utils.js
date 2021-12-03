// ルームIDの生成
export function generateRoomId(idLength) {
  const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let generatedId = "";
  for (let i = 0; i < idLength; i++) {
    generatedId += CHARACTERS.charAt(
      Math.floor(Math.random() * CHARACTERS.length)
    );
  }
  return generatedId;
}

// ユーザリストの返還
export function getUserList(users, roomId) {
  const usersInRoom = users.filter((user) => user.roomId === roomId);
  return usersInRoom.map((user) => user["username"]);
}

// デバイスの取得
export function getDeviceByIPAddress(deviceUsers, ipaddress) {
  return deviceUsers.find((device) => device.ipaddress === ipaddress);
}

//ユーザーネームの取得
export function getDeviceByUsername(phoneUsers, ipaddress) {
  return phoneUsers.find((device) => device.ipaddress === ipaddress);
}

// エラーエミット(全体向け)
export function emitErrorToAll(socket, { roomId, errorMsg }) {
  socket.in(roomId).emit("error", { errorMsg });
}

// エラーエミット(単体デバイス向け)
export function emitErrorToDevice(socket, { targetId, errorMsg }) {
  socket.to(targetId).emit("error", { errorMsg });
}

// エラーエミット(自身向け)
export function emitErrorToSelf(socket, { errorMsg }) {
  socket.emit("error", { errorMsg });
}
