const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const json = require('body-parser/lib/types/json');

const app = express();
const port = 5001; // Using a different port to avoid conflict with Parcel

app.use(cors());

app.use(bodyParser.json());

async function sendEmail(toAddress, jsonString) {
    /*let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'llmvcsend@gmail.com',
            pass: 'llmvcsendpass190'
        }
    });

    const scriptContent = `<script>
    var jsonData = ${jsonString};
    console.log(jsonData);
    // You can add more code to handle the JSON data here
    </script>`;

    const htmlContent = `<html><body>${scriptContent}</body></html>`;

    let mailOptions = {
        from: 'llmvcsend@gmail.com',
        to: toAddress,
        subject: 'LLMVC Audio File',
        text: htmlContent
    };

    try {
        return transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }*/

    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'llmvcsend@gmail.com',
          pass: 'llmvcsendpass190'
        }
      });
      
      var mailOptions = {
        from: 'llmvcsend@gmail.com',
        to: toAddress,
        subject: 'Sending Email using Node.js',
        text: 'That was easy!'
      };
      
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
}

app.post('/send-email', (req, res) => {
    sendEmail(req.body.email, req.body.email.blob)
        .then(info => res.status(200).json({ message: 'Email sent', info }))
        .catch(error => res.status(500).json({ message: 'Error sending email', error }));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
