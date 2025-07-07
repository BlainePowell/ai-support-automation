import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { TICKET_ASSIGNMENTS } from "../constants/UserTypes";
import { SLACK_NOTIFICATIONS } from "../constants/SlackUrls";
dotenv.config();

const app = express();
app.use(express.json());

app.post("/api/ticket-handler", async (req, res) => {
  try {
    const { ticket_id, subject, description } = req.body;

    const prompt = `You are an AI assistant. Classify this ticket into a category and priority. 
    Additionally, write a brief two-sentence summary of the issue.
    
    Subject: ${subject}
    Description: ${description}
    
    Categories: Billing, Bug, Feature Request, General  
    Priorities: Low, Normal, High, Urgent
    
    Respond in the following JSON format:
    
    {
      "category": "Bug",
      "priority": "High",
      "summary": "User is experiencing a timeout error when updating inventory. This could be due to a backend service issue."
    }
    `;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiReply = response.data.choices[0].message.content;
    const { category, priority, summary } = JSON.parse(aiReply);

    await axios.put(
      `https://scoutai.zendesk.com/api/v2/tickets/${ticket_id}.json`,
      {
        ticket: {
          tags: [category.toLowerCase()],
          priority: priority.toLowerCase(),
          assignee_id: TICKET_ASSIGNMENTS[category],
          comment: {
            body: `Auto-tagged by GPT-4:
          
Category: ${category}
Priority: ${priority}
          
Summary: ${summary}`,
            public: false,
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            process.env.ZENDESK_EMAIL +
              "/token:" +
              process.env.ZENDESK_API_TOKEN
          ).toString("base64")}`,
          "Content-Type": "application/json",
        },
      }
    );

    const slackUrls =
      SLACK_NOTIFICATIONS[category] || SLACK_NOTIFICATIONS["General"];

    for (const url of slackUrls) {
      await axios.post(url, {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🎟️ New Ticket 🎟️",
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Category:*\n${category}`,
              },
              {
                type: "mrkdwn",
                text: `*Priority:*\n${priority}`,
              },
              {
                type: "mrkdwn",
                text: `*Subject:*\n${subject}`,
              },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Description:*\n${description}`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "View in Zendesk",
                  emoji: true,
                },
                url: `https://scout3812.zendesk.com/agent/tickets/${ticket_id}`,
                style: "primary",
              },
            ],
          },
        ],
      });
    }

    res.status(200).send("Ticket processed");
  } catch (err) {
    res.status(500).send({ "Internal Server Error": err });
    console.log(err);
  }
});

app.listen(3000, () => console.log("Server is live on port 3000"));
