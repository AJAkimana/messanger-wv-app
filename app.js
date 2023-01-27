/**
 * Copyright 2017-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *
 * Starter Project for Messenger Platform Webview Tutorial
 *
 * Use this project as the starting point for following the
 * Messenger Platform webview tutorial.
 *
 * https://blog.messengerdevelopers.com/using-the-webview-to-create-richer-bot-to-user-interactions-ed8a789523c6
 *
 */

"use strict";

// Imports dependencies and set up http server
const request = require("request"),
  express = require("express"),
  body_parser = require("body-parser"),
  path = require("path"),
  dotenv = require("dotenv").config();

var app = express();

app.set("port", process.env.PORT || 4002);
app.use(body_parser.json());
app.use(express.static("public"));
app.use(express.static("build"));

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const APP_SECRET = process.env.APP_SECRET;

app.listen(app.get("port"), () => {
  console.log("Node app is running on port", app.get("port"));
});

module.exports = app;

// Serve the options path and set required headers
app.get("/options", (req, res, next) => {
  let referer = req.get("Referer");
  // console.log("Start======================>//options");
  if (referer) {
    // console.log("Start=========referer=============>//options");
    if (referer.indexOf("www.messenger.com") >= 0) {
      // console.log("Start=========messenger=============>//options");
      res.setHeader("X-Frame-Options", "ALLOW-FROM https://www.messenger.com/");
    } else if (referer.indexOf("www.facebook.com") >= 0) {
      // console.log("Start=========facebook=============>//options");
      res.setHeader("X-Frame-Options", "ALLOW-FROM https://www.facebook.com/");
    }
    // console.log("Start=========sendFile=============>//options");
    return res.sendFile(path.resolve("build", "index.html"));
  }
  // console.log("End==========Nada============>//options");
  res.sendFile("public/options.html", { root: __dirname });
  // res.send("Ooh, It supposed to be in fb or me, correct");
});

// Handle postback from webview
app.get("/optionspostback", (req, res) => {
  let body = req.query;
  let response = {
    text: `Great, I will book you a ${body.bed} bed, with ${body.pillows} pillows and a ${body.view} view.`,
  };
  // console.log({ body });
  callSendAPI(body.psid, response);
  res
    .status(200)
    .send("Please close this window to return to the conversation thread.");
});

// Accepts POST requests at the /webhook endpoint
app.post("/webhook", (req, res) => {
  // Parse the request body from the POST
  let body = req.body;
  // console.log("===>Body", body);
  // Check the webhook event is from a Page subscription
  if (body.object === "page") {
    body.entry.forEach((entry) => {
      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      // console.log(webhook_event);

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      // console.log(`Sender PSID: ${sender_psid}`);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });

    // Return a '200 OK' response to all events
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Accepts GET requests at the /webhook endpoint
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.TOKEN;

  // Parse params from the webhook verification request
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // console.log("Web hook Endpoind", mode, token, challenge);
  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

app.use("/*", (req, res, next) => {
  res.status(200).send("Success");
});

// Handles messages events
function handleMessage(sender_psid, received_message) {
  let response;

  // Checks if the message contains text
  if (received_message.text) {
    switch (
      received_message.text
        .replace(/[^\w\s]/gi, "")
        .trim()
        .toLowerCase()
    ) {
      case "start connect":
        response = setRoomPreferences(sender_psid);
        break;
      default:
        response = {
          text: `You sent the message: "${received_message.text}".`,
        };
        break;
    }
  } else {
    response = {
      text: `Sorry, I don't understand what you mean.`,
    };
  }
  // console.log(`Sender PSID: ${sender_psid}`);
  // Send the response message
  callSendAPI(sender_psid, response);
}

// Define the template and webview
function setRoomPreferences(sender_psid) {
  let response = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: "Now, you can start the connect app.",
        buttons: [
          {
            type: "web_url",
            url: SERVER_URL + "/options",
            title: "GTM 4 Connect",
            webview_height_ratio: "compact",
            messenger_extensions: true,
          },
        ],
      },
    },
  };

  return response;
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid,
    },
    message: response,
  };
  // console.log("callSendAPI==========>", {
  //   request_body: JSON.stringify(response.attachment?.payload?.buttons),
  // });
  // Send the HTTP request to the Messenger Platform
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: request_body,
    },
    (err, res, body) => {
      if (!err) {
        console.log("message sent!");
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}
