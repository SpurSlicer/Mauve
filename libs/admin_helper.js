// -----------------------IMPORTS-----------------------
const { owners, admins } = require("../jsons/admins.json");


// ------------------------------------------------------
// @description Check if a user is in the owner list in admins.json
// @params user_id: the user checked
// @return whether the user is an owner or not
// ------------------------------------------------------
function isOwner(user_id) {
    for (const owner of owners) {
        if (owner.id == user_id) {
            return true;
        }
    }
    return false;
}

// ------------------------------------------------------
// @description Check if a user is in the admin list in admins.json
// @params user_id: the user checked
// @return whether a user is an admin or not
// ------------------------------------------------------
function isAdmin(user_id) {
    for (const admin of admins) {
        if (admin.id == user_id) {
            return true;
        }
    }
    return false;
}

// ------------------------------------------------------
// @description Check if a user is in either the owner or admin list in admins.json
// @params user_id: the user checked
// @return whether a user is either an owner or an admin or not
// ------------------------------------------------------
function checkSudoPerms(user_id) {
    return isOwner(user_id) || isAdmin(user_id);
}

// -----------------------EXPORTS-----------------------
module.exports = { 
                    isOwner, 
                    isAdmin, 
                    checkSudoPerms 
                };