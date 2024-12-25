### Description
A discord bot made in with node.js (using CommonJS). This bot creates a local database on the user's computer/server and allows for the generation of timed-role commands without the need to write any javascript code yourself. All timed roles can also have qualifiers to further adjust the time (think of the time it takes for a tree (timed role) when there is no water, little water, and lots of water (qualifiers)). All roles must have a default time and can implement qualifiers with ease. Each role has the ability to be applied permanently (infinite time (also the role will still be removable of course)) and removed. This bot was designed to be as scalable and easy to use as possible. The template provides easy-to-use moderation/admin commands using a linux-like syntax. See below for a detalied breakdown of what each `sudo` admin command does. 

**ALL TIMED-ROLE COMMANDS ARE GENERATED VIA JSON!!** That means you don't have to code anything to add commands as they're all automatically generated!! See below for a breakdown of the JSON structure (it's really easy). This bot utilizes a sqlite database via sequelize to allow for absolute storage of roles. Naturally, the database approach allows for all roles to still be kept track of when the bot is offline, so upon restarting the bot, all roles will immediately update. Upon starting the bot, it will automatically add all users with timed roles found in `./jsons/role_info.json` and add them to the database; all new users discovered will be given the role with permanent (infinity) time. It will then scan the database for any users who have left the server and remove them from the database as they no longer need to be tracked. That means you as the bot host won't need to do anything to populate or update the database upon starting the bot. Moreover, both database cleaning role scanning will be performed by the bot automatically every 10 seconds, so you should never have to worry about the database being out of date. Should you still want to clean or rescan, there are admin commands for it. Most importantly, the bot checks for outdated roles every second and updates both user role status and the database. tl;dr: the bot automates most upkeep for you at a frequency that isn't resource intensive or bound by remote database network latency issues.

#### Description - Key Features
- Autogenerates timed roles via json.
- Uses a locally generated database to allow for storage of timed roles even when the offline.
- Autochecks for users that may have gotten timed roles without the bot (meaning they aren't in the database) upon start and every 10 seconds
- Autochecks for users that have left the server with a timed role and deletes them from the database upon start and every 10 seconds
- Autochecks for expired roles
- Provides base set of admin commands in linux syntax as to not bloat the slash command list
- Provides kill switch admin command (`/sudo clear`)
- Uses jsons for admin command access whitelist for easy application of perms to users
- All code is extremely modular and all functions in `./libs` can be accessed anywhere!
- Auto creates commands created in `./commands`
    - All commands are coded to an interface (`build()`) for organization and ease of use purposes
- Just run `./run.bat` while in the bot's root directory to start it 

It basically does everything for you and just needs the roles and admin info while making the addition of new commands and current command changes as simple as possible.
### Requirements
This bot uses `node.js`... so please install that first and foremost.

For npm packages, run `npm install`
### Execution
First, run `touch jsons/admins.json; touch jsons/config.json; touch role_info.json` and enter in the information according to the templates below (copy, paste, and fill in). \
\
For actually running the bot, do one of the following: 
- **Windows**: `./run.bat` in powershell or `run.bat` in cwd 
- **Linux**: `./run.sh`
	- If it throws `Permissoin denied`, run `chmod +x run.sh` and try again
### JSON Organization - role_info.json
All timed role commands are auto generated from the `./jsons/role_info.json` file. Here is a breakdown of how it works: \
&ensp;&ensp;NOTE: Delete the <> when filling stuff in as well as the template text as well as the ... (these are here to show arrays)
```json
{
	"roles": [
        {
			"role_name": "<role name>",
			"role_id": "<role id>",
			"role_duration": <integer in milliseconds>
		},	
        ...	
		{
			"role_name": "<role name>",
			"role_id": "<role id>",
			"role_duration": <integer in milliseconds>
            "qualifiers":
            [
				{
					"qualifier_name": "<qualifier name>",
					"qualifier_duration": <integer in milliseconds>
				},
                ...
			]
		},		
		...
	]
}
```
**roles** [REQUIRED]: This lets the require function actually find the roles object \
**role_name** [REQUIRED]: This is used in command name and description generation. Make sure to capitalize/spell/format it how you'd like as it's solely cosmetic. \
**role_id** [REQUIRED]: This is the role id found in discord by going to \
&ensp;&ensp;`server settings/roles/[right click a role]/copy id`. \
**role_duration** [REQUIRED]: This sets how long the role will last in MILLISECONDS. You can get reeeeally precise with them should you want to. When displayed in the slash commands menu and in bot responses, times will be in minutes. \
**qualifiers** [OPTIONAL]: These add extra options to further adjust times on single timed roles. \
- **qualifier_name** [REQUIRED]: This is also only used for command parameter choice seletion naming, so feel free to format it however you'd like.
- **qualifier_duration** [REQUIRED]: The length you'd like the role to last with that certain qualifier applied in MILLISECONDS.

#### Usage
You can copy the template above for making timed role commands (it's also in the `./jsons/role_info.json)` upon fresh download) and then fill in all of the information. Remember: qualifiers don't need to exist! They are only there if you need them. You can add as many roles as you want, but please keep the qualifiers array for any one command below 25 qualifiers (discord gets mad if you try to add more than that).

### JSON Organization - admins.json
```json
{
    "owners": [
        {
            "id": "<user id>"
        },
        ...
    ],
    "admins": [
        {
            "id": "<user id>"
        },
        ...
    ]
}
```
**owners** [REQUIRED]: This lets the require function actually find the owners object \
**id** [REQUIRED[]]: this array of objects contains user ids of users you'd like to have owner permissions \
**admins** [REQUIRED]: This lets the require function actually find the admins object \
**id** [REQUIRED[]]: this array of objects contains user ids of users you'd like to have admin permissions 

### JSON Organization - config.json
```json
{
	"token": "<token>",
	"clientId": "<client id>",
	"guildId": "<guild id>"
}
```
**token** [REQUIRED]: Open discord development portal`/`Bot`/`Reset Token`/`Copy \
**clientId** [REQUIRED]: Open discord development portal`/`General Information`/`Application Id \
**guildId** [REQUIRED]: Open Discord`/`Right click the server`/`Copy Server Id \


### `sudo` (mod commands)
- `/sudo Print Database`: Sends the current contents of the database to the user in an ephemeral message 
- `/sudo Empty Database`: Clears all entries in the database and deletes every timed role from every user (including permanents)
	- WARNING: This is a DANGEROUS command! Only owners can use it.
- `/sudo Rescan Userbase`: Checks all users with a timed role and ensures that they are tracked in the database. If a user isn't in the database but has a timed role, it will add an entry for them with the end_time set as infinity (permanent).
- `/sudo Clean Database`: Checks every entry in the database to see if the user in the entry is still in the server or not. If a user did leave the server but is still in the database, it will remove them from the database.
- `/sudo Shutdown Bot`: Turns the bot off.
	- WARNING: Restricted to owners only.

### `<timed_role>` (general commands)
`<timed role> ?<time> ?<qualifier>`
- `?<time>`
	- `[BLANK]`: Gives the role for `role_duration` milliseconds as set in the json.
	- `Permanent`: Gives the role for infinity milliseconds
	- `Remove`: Removes the role if the user has it
- `?<qualifier>` \
&ensp;&ensp;&ensp;&ensp;&ensp; **NOTE**: If `?<time>` is not blank, the `?<qualifier>` parameter will be ignored entirely
	- `[BLANK]`: Gives the role for `role_duration` milliseconds as set in the json.
	- `<qualifier>`- Gives the role for the duration specified for that given qualifier in the json
