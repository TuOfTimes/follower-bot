console.log("Twitter Follower Bot is starting...\n");

// require
var Twitter = require("twitter");
var config = require("./config.json");

var T = new Twitter(config.credentials);

// global vars
var friends = []; // array of user_id strings, max 2000 follows at a time

// functions
function delay(time, value) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(value), time);
    });
}

function setRandomInterval(func, minInterval, maxInterval) {
    var randomInterval =
        Math.round(Math.random() * (maxInterval - minInterval)) + minInterval;
    func();
    console.log(`Function called. Calling again in ${randomInterval} ms`);
    setTimeout(() => {
        setRandomInterval(func, minInterval, maxInterval);
    }, randomInterval);
}

function getFriends(cursor) {
    var params = {
        screen_name: config.credentials.screen_name,
        count: 200,
    };

    if (cursor) {
        params.cursor = cursor;
    }

    return T.get("friends/list", params)
        .then((response) => {
            return response;
        })
        .catch((err) => {
            console.log("[Friends] Get: ", err);
            throw err;
        });
}

function getTweets(since_id) {
    var params = {
        q: config.search_keywords.join(" OR "),
        count: 100,
        result_type: "recent",
        lang: "en",
    };

    if (since_id) {
        params.since_id = since_id;
    }

    return T.get("search/tweets", params)
        .then((response) => {
            return response;
        })
        .catch((err) => {
            console.log("[Tweets] Get: ", err);
            throw err;
        });
}

function getAllFriends(cursor) {
    return getFriends(cursor)
        .then((response) => {
            response.users.forEach((user) => {
                if (!friends.includes(user.id_str)) {
                    friends.push(user.id_str);
                }
            });

            console.log(`[Friends] Found total of ${friends.length} friends`);

            if (response.next_cursor_str != "0") {
                return delay(1000 * config.request_delay).then(() => {
                    return getAllFriends(response.next_cursor_str);
                });
            }
        })
        .catch((err) => {
            console.log(`[Friends] Getting all friends failed: ${err}`);
            throw err;
        });
}

function getUser(since_id) {
    return getTweets(since_id)
        .then((response) => {
            for (let i = 0; i < response.statuses.length; i++) {
                if (!response.statuses[i].retweeted_status) {
                    var tweet = response.statuses[i];
                    if (!friends.includes(tweet.user.id_str)) {
                        console.log(
                            `[Users] Found new user with ID of ${tweet.user.id_str}`
                        );
                        return tweet.user.id_str;
                    }
                }
            }

            console.log(
                "[Users] Did not find a new user. Fetching another batch of tweets"
            );
            return delay(1000 * config.request_delay).then(() => {
                return getUser(response.search_metadata.max_id_str);
            });
        })
        .catch((err) => {
            console.log(`[User] Getting a new user ID failed`);
            console.log(err);
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

    if (!friends.includes(userID)) {
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
    friends.push(userID);
}

getAllFriends()
    .then(() => {
        setRandomInterval(
            () => {
                getUser()
                    .then((userID) => {
                        interact(userID);
                    })
                    .catch((err) => {
                        console.log("Error getting user", err);
                    });
            },
            1000 * 240,
            1000 * 360
        );
    })
    .catch((err) => {
        console.log("Program Failed");
        console.log(err);
    });
