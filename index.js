require('dotenv/config');

const express = require('express');
const app = express();

const fetch = require('node-fetch');

const getAuthed = (code) => {
  const url = `https://zoom.us/oauth/token?grant_type=authorization_code&code=${code}&redirect_uri=${process.env.redirectURL}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(
        process.env.clientID + ':' + process.env.clientSecret
      ).toString('base64')}`,
    },
  })
    .then((r) => {
      if (r.ok) return r.json();
      throw r;
    })
    .catch((err) => console.error('error in getAuthed', err));
};

// there's a limit of requesting a 1 month range for recordings
// so it will take several requests to get everything
const getRecordings = (month, token) => {
  const startMonth = month.toString().padStart(2, '0');
  const endMonth = (month + 1).toString().padStart(2, '0');
  return fetch(
    `https://api.zoom.us/v2/users/me/recordings?page_size=300&from=2020-${startMonth}-01&to=2020-${endMonth}-01`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  ).then((r) => r.json());
};

// hook up oauth
app.get('/zoom', async (req, res) => {
  console.log('/zoom request');
  // Step 1:
  // Check if the code parameter is in the url
  // if an authorization code is available, the user has most likely been redirected from Zoom OAuth
  // if not, the user needs to be redirected to Zoom OAuth to authorize
  if (req.query.code) {
    console.log('got a code');
    // Step 3:
    // Request an access token using the auth code
    const authBody = await getAuthed(req.query.code);

    if (authBody.access_token) {
      console.log('got a token');
      let meetings = [];
      let month = 3; // TODO: use state (from OAuth) in queryString to set month range
      let endMonth = 7;
      // Step 4:
      // We can now use the access token to authenticate API calls
      try {
        while (month <= endMonth) {
          console.log('fetching month', month);
          const recordings = await getRecordings(month, authBody.access_token);
          meetings.push(...recordings.meetings);
          month++;
        }
      } catch (err) {
        console.log(err);
        return res.send(err.message);
      }
      res.json(meetings);
    }
    return;
  }

  // If no authorization code is available, redirect to Zoom OAuth to authorize
  res.redirect(
    `https://zoom.us/oauth/authorize?response_type=code&client_id=${process.env.clientID}&redirect_uri=${process.env.redirectURL}`
  );
});

const port = process.env.PORT || 4000;

app.listen(port, () => console.log(`Zoom app listening at PORT: ${port}`));
