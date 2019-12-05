import firebase from "firebase/app";
import "firebase/messaging";

export default class Firebase {
  constructor({ onMessage = () => {}, onTokenRefresh = () => {} } = {}) {
    this.instance = undefined;
    this.init()
      .then(() =>
        this.attachEventHandlers({
          onMessage,
          onTokenRefresh
        })
      )
      .catch(error => {
        throw new Error(error);
      });
  }

  init() {
    return new Promise((resolve, reject) => {
      // Add you own API info here.
      const config = {
        apiKey: "",
        authDomain: "",
        databaseURL: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: ""
      };

      if (!firebase) {
        reject(new Error("Firebase instance missing!"));
      }

      // Only need to initalize if Firebase hasn't already been initalized.
      this.instance = !firebase.apps.length
        ? firebase.initializeApp(config)
        : firebase;
      resolve();
    }).then(() => this.initMessaging());
  }

  // Instantiates the Messaging instance of the internal Firebase instance.
  initMessaging() {
    return new Promise(resolve => {
      // Set the Firebase Messaging instance if it's not present.
      this.instance.messaging = this.instance.messaging();
      resolve();
    });
  }

  attachEventHandlers(handlers = {}) {
    Object.keys(handlers).forEach(eventName => {
      this.instance.messaging[eventName](handlers[eventName]);
    });
  }

  getToken() {
    return this.instance.messaging.getToken();
  }

  deleteToken(token) {
    return this.instance.messaging.deleteToken(token);
  }

  requestPermission() {
    return this.instance.messaging.requestPermission();
  }

  useServiceWorker(serviceWorker = {}) {
    return this.instance.messaging.useServiceWorker(serviceWorker);
  }
}
