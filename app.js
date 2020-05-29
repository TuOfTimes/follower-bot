console.log("Twitter Follower Bot is starting...\n");

// require
var Twitter = require("twitter");
var config = require("./config.json");

var T = new Twitter(config.credentials);

// global vars
var params = {
    q: config.search_keywords.join(" OR "),
    count: 100,
    result_type: "recent",
    lang: "en",
};

var friends = new Set(); // array of user_id strings, max 2000 follows at a time

// functions
function getFriends(cursor) {
    var friends_param = {
        screen_name: config.credentials.screen_name,
        count: 200,
    };

    if (cursor) {
        friends_param.cursor = cursor;
    }

    return T.get("friends/list", friends_param)
        .then((results) => {
            return results;
        })
        .catch((err) => {
            throw err;
        });
}

function getAllFriends(cursor) {
    setTimeout(() => {
        getFriends(cursor)
            .then((results) => {
                results.users.forEach((user) => {
                    friends.add(user.id_str);
                });
                console.log(
                    `[Friends] Friends list now has ${friends.size} entries`
                );
                if (results.next_cursor_str == "0") {
                    return;
                } else {
                    // console.log(results.next_cursor_str);
                    return getAllFriends(results.next_cursor_str);
                }
            })
            .catch((err) => {
                console.log(`[Friends] Getting all friends failed: ${err}`);
                return;
            });
    }, 1000 * 3);
}

function getUser() {
    return T.get("search/tweets", params)
        .then((data) => {
            for (let i = 0; i < data.statuses.length; i++) {
                var tweet;
                if (data.statuses[i].retweeted_status) {
                    tweet = data.statuses[i].retweeted_status;
                } else {
                    tweet = data.statuses[i];
                }

                if (!friends.has(tweet.user.id_str)) {
                    console.log(
                        `[Users] Found new user with ID of ${tweet.user.id_str}`
                    );
                    return tweet.user.id_str;
                }
            }
            return getUser();
        })
        .catch((err) => {
            console.log("[Tweets] Get: ", err);
            throw err;
        });
}

function unfollowTweeter(userID) {
    T.post("friendships/destroy", {
        user_id: userID,
    })
        .then((response) => {
            console.log("[Users] Unfollowed: ", `@${response.screen_name}`);
        })
        .catch((err) => {
            console.log("[Users] Unfollow: ", err[0].message);
        });
}

function followTweeter(userID) {
    T.post("friendships/create", {
        user_id: userID,
        follow: true,
    })
        .then((response) => {
            console.log("[Users] Followed: ", `@${response.screen_name}`);
        })
        .catch((err) => {
            console.log("[Users] Follow: ", err[0].message);
        });
}

function interact(userID) {
    console.log(`[Interact] Following user ` + userID);

    if (!friends.has(userID)) {
        if (friends.length == 2000) {
            const toUnfollow = friends.shift();
            console.log(
                `[Interact] Already at 2000 friends. Unfollowing user with ID ${toUnfollow}`
            );
            unfollowTweeter(toUnfollow);
        } else {
            followTweeter(userID);
        }
    } else {
        friends.splice(friends.indexOf(userID), 1);
        console.log("[Interact] Already following ", userID);
    }
    friends.add(userID);
}

function loop() {
    getUser().then((userID) => {
        interact(userID);
    });
    setTimeout(loop, 1000 * 216);
}

getAllFriends();
loop();
