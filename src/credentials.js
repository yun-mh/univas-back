require("dotenv").config();

module.exports = {
  type: "service_account",
  project_id: "univas-translator",
  private_key_id: process.env.TRANSLATOR_KEY_ID,
  private_key: process.env.TRANSLATOR_KEY,
  client_email: "crt-797@univas-translator.iam.gserviceaccount.com",
  client_id: "110986107053846211888",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/crt-797%40univas-translator.iam.gserviceaccount.com",
};
