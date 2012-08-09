var ui = {
    init: function() {
        ui.chat.init();
        ui.player.init();
    },
    __eventUrl: 'event.json',
    playlist: {
        __playlist: {},
        __url: '',
        init: function(callback) {
            var this_class = this;
            $.getJSON(this.__url, function(data) {
                this_class.__playlist = data;
                ui.playlist.importData(data);
            });
            
            if (typeof(callback) == 'function') {
                callback();
            }
        },
        importData: function(data) {
            var itemIndex = 0;
            var delayFactor = 50;
            var fadeSpeed = 300;
            for (var i=0; i<data.sections.length; i++) {
                var section = data.sections[i];
                var html = '<div class="playlist_header">' + section.title + '</div><ul class="playlist_items"></ul>';
                $(html).css({'opacity': '0'}).appendTo("#playlist").delay(delayFactor * itemIndex).fadeTo(fadeSpeed, 1);
                itemIndex++;
                var html = '';
                for (var a=0; a<section.songs.length; a++) {
                    var song = section.songs[a];
                    var html = '<li>' + song.title + '</li>';
                    $(html).css({'opacity': '0'}).appendTo("#playlist ul:last-child").delay(delayFactor * itemIndex).fadeTo(fadeSpeed, 1).attr({'data-id': song.id, 'data-duration': song.duration});
                    itemIndex++;
                    
                }
            }
        },
        setCurrent: function(title) {
            $("#playlist li").each(function(){
                if ($(this).html() == title) {
                    $("#playlist li").removeClass('current_song');
                    $(this).addClass('current_song');
                    return false;
                }
            })
        },
        getSongs: function() {
            var data = ui.playlist.__playlist;
            var songs = [];
            for (var i=0; i<data.sections.length; i++) {
                for (var a=0; a<data.sections[i].songs.length; a++) {
                    songs.push(data.sections[i].songs[a]);
                }
            }
            
            //songs = songs.reverse();
            
            return songs;
        }
    },
    users: {
        refresh: function(newArray) {
            var results = this.__search(this.__getOldArray(), newArray);
            for (var i=0; i<results.remove.length; i++) {
                this.__remove(results.remove[i].index);
            }
            for (var i=0; i<results.add.length; i++) {
                this.__add(results.add[i].index, results.add[i].name);
            }
        },
        __getOldArray: function() {
            var oldArray = [];
            $("#users_list li").each(function() {
                oldArray.push($(this).html());
            });
            return oldArray;
        },
        __search: function(oldArray, newArray) {
            var results = {
                remove: [],
                add: [],
            };
            // Iterate through old users and find users to remove
            var i = 0;
            while (i<oldArray.length) {
                var item = oldArray[i];
                var index = $.inArray(item, newArray);
                if (index == -1) {
                    // User should be removed, is no longer in new list 
                    // Get old index, then remove from old array to recalculate index for next item
                    var index = $.inArray(item, oldArray);
                    results.remove.push({index: index});
                    oldArray.pop(index);
                } else {
                    i++;
                }
            }
            
            // Iterate through new users and find users to add
            var i = 0;
            while (i<newArray.length) {
                var item = newArray[i];
                var index = $.inArray(item, oldArray);
                if (index == -1) {
                    // Found a new user to add, figure out the new index
                    // Add to array and then resort to calculate where it should go
                    oldArray.push(item);
                    oldArray.sort();
                    var index = $.inArray(item, oldArray);
                    results.add.push({index: index, name: item});
                }
                i++;
            }
            
            return results;
        },
        __add: function(index, name) {
            // index is the new index of the item after insertion
            var html = '<li>' + name + '</li>'; 
            var $object = $(html);
            $object.css({height: 0, opacity: 1}).addClass('animating');
            if (index < $("#users_list li:not(.animating)").length) {
                $("#users_list li:not(.animating)").eq(index).before($object);
            } else {
                $("#users_list").append($object);
            }
            $object.animate({height: '1.3em', opacity: 1}, 500, function(){
                $(this).removeClass('animating');
            });
        },
        __remove: function(index) {
            $("#users_list li:not(.animating)").eq(index).addClass('animating').animate({height: '0em', opacity: 0}, 500, function() {
                $(this).remove();
            });
        }
        
    },
    chat: {
        name: 'anonymous',
        __getURL: function() {
            return 'chat.php?name=' + encodeURIComponent(this.name)
        },
        init: function() {
            // Initialize Server-Sent Events service
            if (!!window.EventSource) {
                var source = new EventSource(this.__getURL());
                
                // Add event handlers
                source.addEventListener('users', function(e) {
                    var data = JSON.parse(e.data);
                    ui.users.refresh(data);
                }, false);
                source.addEventListener('message', function(e) {
                    var data = JSON.parse(e.data);
                    ui.chat.message.display(data.name, data.message);
                }, false);
                source.addEventListener('typing', function(e) {
                    var data = JSON.parse(e.data);
                    ui.chat.typingNotification.display(data.name);
                }, false);
                source.addEventListener('debug', function(e) {
                    console.log(e.data);
                })
                
                // Bind event handler to the input field to send a message
                $("#chat_input_content").keypress(function(e) {
                    // Send a typing notification, at most once a second
                    ui.chat.typingNotification.send();
                    
                    // If the enter key is pressed
                    if (e.which == 13) {
                        // Get the current message
                        var message = $("#chat_input_content").val();
                        
                        // Send the message
                        ui.chat.message.send(message);
                        
                        // Clear the message from the input field
                        $("#chat_input_content").val("");
                    }
                });
                
                // Update the typing notifications once
                ui.chat.typingNotification.__update();
            } else {
                alert("Sorry, your browser does not support real-time chat. Enjoy the music!");
            }
        },
        message: {
            display: function(name, message) {
                var html = '<div class="chat_history_item"><span class="chat_history_item_name">' + name + '</span><span class="chat_history_item_message">' + message + '</span></div>';
                $("#chat_history_typing").before(html);
                
                // Remove any typing notification from this user
                ui.chat.typingNotification.remove(name);
            },
            send: function(message) {
                $.post(ui.chat.__getURL(), {'message': message});
            }
        },
        typingNotification: {
            __timeout: 3000,
            display: function(name) {
                this_class = this;
                
                // Clear the typing notification automatically after 3 seconds without an update
                // Reset the typing notification timer
                if (typeof(this.__current[name]) != 'undefined') {
                    window.clearTimeout(this.__current[name].timeoutID);
                }
                this.__current[name] = {};
                // Set a new timer
                this.__current[name].timeoutID = window.setTimeout(function() {
                    this_class.remove(name);
                }, this.__timeout);
                this.__current[name].name = name;
                
                this.__update();
            },
            __current: {},
            remove: function(name) {
                if (typeof(this.__current[name]) != 'undefined') {
                    window.clearTimeout(this.__current[name].timeoutID);
                    delete this.__current[name];
                    this.__update();
                }
            },
            __hidden: false,
            __update: function() {
                var count = utils.objCount(this.__current);
                if (count == 0) {
                    if (!this.__hidden) {
                        $("#chat_history_typing").html("").stop(true).animate({'height': '0'}, 100);
                        this.__hidden = true;
                    }
                } else {
                    var names = [];
                    for (item in this.__current) {
                        names.push(item);
                    }
                    var phrase = "";
                    if (count == 1) {
                        phrase = names[0] + " is typing";
                    } else if (count == 2) {
                        phrase = names[0] + " and " + names[1] + " are typing";
                    } else {
                        for (var i=0; i<(names.length-1); i++) {
                            phrase = phrase + names[i] + ", ";
                        }
                        phrase = phrase + "and " + names[names.length-1] + " are typing"; 
                    }
                    $("#chat_history_typing").html(phrase);
                    if (this.__hidden) {
                        $("#chat_history_typing").stop(true).animate({'height': '20px'}, 100);
                        this.__hidden = false;
                    }
                }
            },
            lastSent: 0,
            __floodRate: 1000,
            send: function() {
                if (Date.now() - this.lastSent > this.__floodRate) {
                    $.post(ui.chat.__getURL(), {'event': 'typing'});
                    this.lastSent = Date.now();
                }
            }
        }
    },
    controls: {
        
    },
    player: {
        __timeOffset: 0,
        __eventData: {},
        getTime: function() {
            return Math.floor(Date.now() / 1000) + this.__timeOffset;
        },
        init: function() {
            // Get event information
            $.getJSON(ui.__eventUrl, function(eventData) {
                console.log("Got event information");
                ui.player.__eventData = eventData;
                // Load current event playlist
                ui.playlist.__url = eventData.playlist;
                ui.playlist.init(function() {
                    console.log("Loaded playlist");
                    // Sync time with server
                    $.get("time.txt?" + Date.now(), function(data, text, xhr) {
                        var dateStr = xhr.getResponseHeader('Date');
                        var serverTime = Date.parse(new Date(Date.parse(dateStr)).toUTCString()) / 1000;
                        var localTime = Date.parse(new Date().toUTCString()) / 1000;
                        ui.player.__timeOffset = serverTime -  localTime;
                        
                        console.log("Time offset calculated: " + ui.player.__timeOffset);
                        
                        // Use event start time to calculate current position in playlist
                        var startTime = ui.player.__eventData.startTime;
                        var timelinePosition = ui.player.getTime() - startTime;
                        
                        console.log(timelinePosition);
                        
                        // Make sure that the event has started, else don't play
                        if (timelinePosition < 0) {
                            alert("The event hasn't started yet!");
                        } else {
                            // Now figure out what song should be playing now
                            var songs = ui.playlist.getSongs();
                            console.log(songs);
                            var totalDuration = 0;
                            var currentIndex = null;
                            for (var i=0; i<songs.length; i++) {
                                totalDuration = totalDuration + songs[i].duration;
                                if (totalDuration > timelinePosition) {
                                    console.log("Found song at duration " + totalDuration);
                                    currentIndex = i;
                                    var time = timelinePosition - (totalDuration - songs[i].duration);
                                    break;
                                }
                            }
                            
                            console.log(currentIndex);
                            
                            // If we ran out of songs, then the event is over
                            if (currentIndex == null) {
                                alert("Oops, the event is over already!");
                            } else {
                                // Setup the timeline and start playback
                                ui.player.timelineSetup(currentIndex, time);
                            }
                        }
                            
                    });
                });
            });
        },
        timelineSetup: function(index, time) {
            var songs = ui.playlist.getSongs();
            
            // Insert timeouts for playing the next songs to create the timeline
            var totalTimeRemaining = songs[index].duration - time;
            for (var i=index+1; i<songs.length; i++) {
                console.log("Adding timeout at: " + totalTimeRemaining + " for song " + i);
                this.__timelineAdd(i, totalTimeRemaining);
                totalTimeRemaining = totalTimeRemaining + songs[i].duration;
            }
            
            // Insert timeout for ending playback
            console.log("Adding final timeout at: " + totalTimeRemaining);
            window.setTimeout(function() {
                ui.player.end();
            }, totalTimeRemaining * 1000);
            
            // Play current song now
            ui.player.play(index, time);
        },
        __timelineAdd: function(index, delay) {
            window.setTimeout(function() {
                ui.player.play(index, 0);
            }, delay * 1000);
        },
        play: function(index, time) {
            console.log("Playing song " + index + " at time " + time);
            var songs = ui.playlist.getSongs();
            var song = songs[index];
            drivers.music.play(song, time);
        },
        end: function() {
            return;
        }
    }
}

var drivers = {
    music: {
        __player: null,
        __firstPlay: true,
        play: function(song, time) {
            if (this.__player == null) {
                this.__player = new YT.Player('player', {
                    height: '200',
                    width: '280',
                    videoId: song.id,
                    playerVars: {
                        controls: 0,
                        disablekb: 1,
                        showsearch: 0,
                        modestbranding: 1,
                        enablejsapi: 1
                    },
                    events: {
                        'onReady': function(e) {
                            if (drivers.music.__firstPlay) {
                                e.target.seekTo(time, true);
                                drivers.music.__firstPlay = false;
                            }
                        },
                        'onStateChange': function(e) {
                            if (e.data == YT.PlayerState.PAUSED) {
                                e.target.playVideo();
                            }
                        }
                    }
                });
            } else {
                this.__player.loadVideoById(song.id);
            }
        }
    }
}

var utils = {
    objCount: function(obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    }
}

var includes = {
    __scripts: ['//www.youtube.com/iframe_api'],
    __numLoaded: 0,
    init: function() {
        for (var i=0; i<this.__scripts.length; i++) {
            $.getScript(this.__scripts[i], function() {
                includes.loaded();
            })
        }
    },
    loaded: function() {
        this.__numLoaded++;
        if (this.__numLoaded == this.__scripts.length) {
            ui.init();
        }
    }
}

$(function() {
    includes.init();
});
