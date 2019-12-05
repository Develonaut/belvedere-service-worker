import Firebase from "lib/Firebase";
import { parseQueryParams } from "conf/urls";

export default class ServiceWorker {
  constructor() {
    this.Firebase = new Firebase();
    this.schema = parseQueryParams(self.location.search);
    // Standard Lifecycle Methods
    // Registration/Instalation/Activation
    self.addEventListener("install", this.onInstall);
    self.addEventListener("activate", this.onActivate);
    // Notification Events
    self.addEventListener("notificationclick", this.onNotificationClick);
    self.addEventListener("notificationclose", this.onNotificationClose);
    // Push Events
    self.addEventListener("push", this.onPush);
    self.addEventListener(
      "pushsubscriptionchange",
      this.onPushSubscriptionChange
    );
  }

  onInstall() {}
  onActivate() {}
  onNotificationClick() {}
  onNotificationClose() {}

  onPush({ waitUntil, data }) {
    waitUntil(
      parseNotification(data)
        .then(({ show, notification }) => {
          if (show) return this.displayNotification(notification);
        })
        .catch(error => {
          throw new Error(error);
        })
    );
  }

  async parseNotification(delta = undefined) {
    // TODO Show Previous Notification if broken Notification comes in.
    if (!delta) throw new Error("Broken Notification");
    const { pushcontent } = delta;
    const notification = pushcontent === "base" ? delta : null;

    return Promise.resolve({
      notification,
      show: true
    });
  }

  onPushSubscriptionChange(event) {
    console.log("Subscription expired");
    event.waitUntil(
      self.registration.pushManager
        .subscribe({ userVisibleOnly: true })
        .then(function(subscription) {
          console.log("Subscribed after expiration", subscription.endpoint);
          return fetch("register", {
            method: "post",
            headers: {
              "Content-type": "application/json"
            },
            body: JSON.stringify({
              endpoint: subscription.endpoint
            })
          });
        })
    );
  }
}

//onNotificationClick
async function onNotificationClicked(event) {
  event.notification.close();

  const notification = event.notification.data;
  console.log("notification = ", notification);
}

//onNotificationClosed
async function onNotificationClosed(event) {
  const notification = event.notification.data;
  console.log("notification = ", notification);
}

//onServiceWorkerInstalled
/*
    This function is called when the "install" event is called
    Either a user installed this service worker for the first time
    Or a user is updating service worker.

    This is where we fire the notify_register event.

    TODO: What we can do it fire a different event when
    the user is just updating the service worker
*/
async function onServiceWorkerInstalled(event) {
  console.log("onServiceWorkerInstalled = ", event);

  //Check if we already have information on the user
  //If yes then its an updated service worker
  //if no then its a new user
  let existingUserData = await getTrackingInformation();
  console.log("existingUserData = ", existingUserData);

  if (existingUserData.length === 0) {
    console.log("Calling setUserData");
    let setUserData = await SetUserData();
    console.log("setUserData = ", setUserData);
    let fireTrackingEvent = await logImpression("newuser");
    console.log("fireTrackingEvent = ", fireTrackingEvent);
  } else {
    let fireTrackingEvent = await logImpression("existinguser");
    console.log("fireTrackingEvent = ", fireTrackingEvent);
  }
  console.log("calling self.skipWaiting()");
  return self.skipWaiting();
}

//onServiceWorkerActivated
async function onServiceWorkerActivated(event) {
  console.log("onServiceWorkerActivated = ", event);
  event.waitUntil(self.clients.claim());
}
//onPushSubscriptionChange
async function onPushSubscriptionChange(event) {
  console.log("event = ", event);
}

//Setting user data to the indexedDB from the location of the service worker
async function SetUserData() {
  return new Promise((resolve, reject) => {
    //First check parameters on the service worker registration itself
    let User = GetParameterUserData();

    //Then need to check cookies somehow...
    if (User.userid == null || User.userid.includes("{")) {
      User.userid = "{userid}";
    }

    if (User.userclass == null || User.userclass.includes("{")) {
      User.userclass = "{userclass}";
    }

    if (User.PTC == null || User.PTC.includes("{")) {
      User.PTC = "{pushTrackingCookie}";
    }

    //Then set it forever in indexedDB
    db.then(db => {
      const tx = db.transaction("users", "readwrite");
      tx.objectStore("users").put({
        id: "tracking",
        data: User
      });
      console.log("Inside SetUserData: User = ", User);
      resolve(User);
    }).catch(error => {
      sendFetchAdvanced("notify_error", {
        subid6: error,
        subid7: "sw",
        subid8: "SetUserData"
      });
    });
  });
}

function GetParameterUserData() {
  try {
    let User = {};
    let parameterUserData = getParams(location);
    console.log(
      "User Data From window.location of the service worker = ",
      parameterUserData
    );
    for (let prop in parameterUserData) {
      if (parameterUserData[prop] !== "default") {
        //console.log("Found one ", parameterUserData[prop]);
        User[prop] = parameterUserData[prop];
      }
    }
    return User;
  } catch (error) {
    sendFetchAdvanced("notify_error", {
      subid6: error,
      subid7: "sw",
      subid8: "getParams"
    });
  }
}

function getParams(url) {
  try {
    let params = {};
    let search = location.search.substring(1);
    if (search.length == 0) {
      return params;
    }
    params = JSON.parse(
      `{"${search.replace(/&/g, '","').replace(/=/g, '":"')}"}`,
      function(key, value) {
        return key === "" ? value : decodeURIComponent(value);
      }
    );
    return params;
  } catch (error) {
    sendFetchAdvanced("notify_error", {
      subid6: error,
      subid7: "sw",
      subid8: "getParams"
    });
  }
}

//Get Stored user data from indexedDB
async function getTrackingInformation() {
  return new Promise((resolve, reject) => {
    db.then(db => {
      return db
        .transaction("users")
        .objectStore("users")
        .getAll();
    })
      .then(allObjs => {
        resolve(allObjs);
      })
      .catch(error => {
        sendFetchAdvanced("notify_error", {
          subid6: error,
          subid7: "sw",
          subid8: "GetDBUserData"
        });
        reject(false);
      });
  });
}

//Function used to send an impression.
async function logImpression(event, impressionData = {}) {
  const trackingInformation = await getTrackingInformation();

  let user = trackingInformation.userid || "{userid}";
  let userclass = trackingInformation.userclass || "{userclass}";
  let _token = impressionData.token || "";
  let imp = "{imp}";
  let url = encodeURIComponent(impressionData.url) || "";
  let title = encodeURIComponent(impressionData.headline) || "";
  let pushid = impressionData.pushid || "0";
  let image = impressionData.image || "";
  let publisher = trackingInformation.publisher || "{publisher}";
  let subid1 = trackingInformation.subid1 || impressionData.subid1 || "";
  let subid2 = trackingInformation.subid2 || impressionData.subid2 || "";
  let subid3 = trackingInformation.subid3 || impressionData.subid3 || "";
  let subid4 = trackingInformation.subid4 || impressionData.subid4 || "";
  let subid5 = trackingInformation.subid5 || impressionData.subid5 || "";
  let subid6 = impressionData.subid6 || impressionData.pushcontent || "";
  let subid7 = impressionData.subid7 || impressionData.topic || "";
  let subid8 = impressionData.subid8 || impressionData.uniqueID || "";
  let subid9 =
    trackingInformation.PTC || impressionData.subid9 || "{pushTrackingCookie}";
  let subid10 = impressionData.subid10 || "";

  const request = new Request(
    `https://[your-url]?event=${event}&user=${user}&userclass=${userclass}&token=${_token}&imp=${imp}&url=${url}&title=${title}&pushid=${pushid}&image=${image}&publisher=${publisher}&subid1=${subid1}&subid2=${subid2}&subid3=${subid3}&subid4=${subid4}&subid5=${subid5}&subid6=${subid6}&subid7=${subid7}&subid8=${subid8}&subid9=${subid9}&subid10=${subid10}`,
    {
      mode: "no-cors"
    }
  );
  console.log("Sending impression: ", request);
  return await fetch(request);
  //const data = await response.json();
}

//Logic that displays the final notification to the user
async function displayNotification(notification) {
  let notificationOptions = {
    body: notification.body,
    icon: notification.icon,

    //  On Chrome 56, a large image can be displayed:
    image: notification.image,
    /*  On Chrome 44+, use this property to store extra information which
         you can read back when the notification gets invoked from a
         notification click or dismissed event. We serialize the
         notification in the 'data' field and read it back in other events.
    */
    data: notification,

    /*  On Chrome 48+, action buttons show below the message body of the
       notification. Clicking either button takes the user to a link. See:
       https://developers.google.com/web/updates/2016/01/notification-actions
    */
    actions: notification.buttons,
    /*
         Tags are any string value that groups notifications together. Two
         or notifications sharing a tag replace each other.
         If a tag is not provided assign a unique value
         */
    tag: notification.tag || new Date(),
    /*
         On Chrome 47+ (desktop), notifications will be dismissed after 20
         seconds unless requireInteraction is set to true.
         if a value isn't provided in the notification object the default value is true.
         See:
         https://developers.google.com/web/updates/2015/10/notification-requireInteractiom
         */
    requireInteraction: notification.requireInteraction || true,
    /*
        On Chrome 50+, by default notifications replacing
        identically-tagged notifications no longer vibrate/signal the user
        that a new notification has come in. This flag allows subsequent
        notifications to re-alert the user. See:
        https://developers.google.com/web/updates/2016/03/notifications
        */
    renotify: true,
    /*
         On Chrome 53+, returns the URL of the image used to represent the
         notification when there is not enough space to display the
         notification itself.

         The URL of an image to represent the notification when there is not
         enough space to display the notification itself such as, for
         example, the Android Notification Bar. On Android devices, the
         badge should accommodate devices up to 4x resolution, about 96 by
         96 px, and the image will be automatically masked.
         */
    badge: notification.badge,
    /*
        A vibration pattern to run with the display of the notification. A
        vibration pattern can be an array with as few as one member. The
        values are times in milliseconds where the even indices (0, 2, 4,
        etc.) indicate how long to vibrate and the odd indices indicate how
        long to pause. For example [300, 100, 400] would vibrate 300ms,
        pause 100ms, then vibrate 400ms.
         */
    vibrate: notification.vibrate
  };
  console.log("Showing Notification");
  console.log("Title = ", notification.title);
  console.log("Options = ", notificationOptions);
  return Promise.resolve(
    self.registration.showNotification(notification.title, notificationOptions)
  );
}
