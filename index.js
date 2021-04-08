const AWS = require("aws-sdk");
const ses = new AWS.SES();
const dynamodb = new AWS.DynamoDB();
AWS.config.update({ region: "us-east-1" });

exports.handler = (event, context, callback) => {
    let snsNotification = event.Records[0].Sns;
    let message = JSON.parse(snsNotification.Message);

    var searchParams = {
        TableName: process.env.tableName,
        FilterExpression:
            "(book_id = :book_id) AND (book_name = :book_name) AND (email = :email) AND (flag = :email_check_flag)",
        ExpressionAttributeValues: {
            ":book_id": { S: message.book_id },
            ":book_name": { S: message.book_name },
            ":email": { S: message.email },
            ":email_check_flag" : { S: message.email_check_flag}
        },
    };

    console.log("Get item from DynamoDb for user:" + message.email);
    const getItem = dynamodb.scan(searchParams).promise();

    getItem.then((data) => {
        let email_subject = "";
        let email_data = "";
        let book_url = "http://" + message.api_url + "/books/" + message.book_id;
        console.log(message.email_check_flag);
        if (data.Count == 0) {
            console.log("Sending Email Notification");
            if (message.email_check_flag == "book_created") {
                email_subject = "Book " + message.book_name + " Created";
                email_data = "The following book is created:\n\n" +
                    "Book ID: " +
                    message.book_id +
                    "\n\n" +
                    "Title: " +
                    message.book_name +
                    "\n\n" +
                    "URL: " +
                    book_url;
            } else if (message.email_check_flag == "book_deleted") {
                email_subject = "Book " + message.book_name + " Deleted";
                email_data = "The following book is deleted:\n\n" +
                    "Book ID: " +
                    message.book_id +
                    "\n\n" +
                    "Title: " +
                    message.book_name;
            }
            const sendEmail = ses.sendEmail({
                Destination: {
                    ToAddresses: [message.email],
                },
                Message: {
                    Body: {
                        Text: {
                            Data: email_data,
                        },
                    },
                    Subject: {
                        Data: email_subject
                    }
                },
                Source: "noreply@" + message.api_url
            }).promise();

            sendEmail.then(data => {
                console.info("Email sent successfully");

                console.info("Put email record in dynamodb");

                let items = {
                    TableName: process.env.tableName,
                    Item: {
                        id: { S: snsNotification.MessageId },
                        subject: { S: email_subject },
                        book_id: { S: message.book_id },
                        book_name: { S: message.book_name },
                        email: { S: message.email },
                        flag : { S: message.email_check_flag}
                    }
                };

                dynamodb.putItem(items, function (err, data) {
                    if (err)
                        console.log(err, err.stack);
                    else
                        console.log("Added item in dynamodb" + data);
                });
            })
                .catch(err => {
                    console.error("Unable to send email: " + err);
                });
        }
        else {
            console.info("Email already sent");
        }
    });
};