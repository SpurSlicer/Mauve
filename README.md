Heyy here is a break down on how this bot works:

### Try to avoid messing with the following files:
- deploy-commands.js
- index.js
### How to run bot: 
1. execute *deploy-commands.js* via node.js to update slash command list
2. execute *index.js* to run the bot

### Things to do: 
- Make sure you make example in example.js match the command name. It will make this much easier.
- Feel free to make as many commands as you want in the commands folder! example.js was designed to be copy and pasted for like 50 different roles if you want lol.

### Terminology: 
If you are new to discord bot development, here are some terms to get you more familiar!
- **Guild**: This just means server. It's just called this internally iirc
- **Interaction**: These are what slash commands are called internally.
- **Ephemeral**: When you set this to "true" in a reply, then the response will be privatised and have the "only you can see this message" thing at the bottom of it. Naturally, reply and followup interactions have this as false.      
- **Reply vs Followup**: You can only send ONE reply per command, (replys just, well, reply physically to the users original slash command message). Followups will reply to the original reply message that the bot sent, meaning followups must come after replys. You can have as many followups as you want though as followups to followups exist and can be useful (or annoying). 


Thanks for reading and I hope this helps you with your server!
