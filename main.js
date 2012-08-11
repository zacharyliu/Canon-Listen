var ui = {
    init: function() {
        // Get a chat username from the user
        var prompt = new ui.prompt('Enter your name:', $.cookie('chat_name'));
        prompt.onSubmit(function(data) {
            ui.chat.name = data;
            $.cookie('chat_name', data, {expires: 365});
            
            ui.chat.init();
            ui.controls.init();
            ui.player.init();
        });
        prompt.show();
    },
    __eventUrl: 'events.php',
    playlist: {
        __playlist: {},
        __url: '',
        __totalPlaylistDuration: 0,
        init: function(callback) {
            var this_class = this;
            $.getJSON(this.__url + '?' + Date.now(), function(data) {
                this_class.__playlist = data;
                ui.playlist.importData(data);
                if (typeof(callback) == 'function') {
                    callback();
                }
            });
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
                    ui.playlist.__totalPlaylistDuration = ui.playlist.__totalPlaylistDuration + song.duration;
                    var html = '<li>' + song.title + '</li>';
                    $(html).css({'opacity': '0'}).appendTo("#playlist ul:last-child").delay(delayFactor * itemIndex).fadeTo(fadeSpeed, 1);
                    itemIndex++;
                }
            }
            console.log("Total playlist duration: " + ui.playlist.__totalPlaylistDuration);
        },
        setCurrent: function(title) {
            $("#playlist li").each(function(){
                if ($(this).html() == title) {
                    $("#playlist li").removeClass('current_song');
                    $(this).addClass('current_song');
                    $("#playlist").scrollTo($(this), 300);
                    return false;
                }
            });
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
            newArray = newArray.sort();
            var results = this.__search(this.__getOldArray(), newArray);
            for (var i=0; i<results.remove.length; i++) {
                this.__remove(results.remove[i].index);
            }
            for (var i=0; i<results.add.length; i++) {
                this.__add(results.add[i].index, results.add[i].name);
            }
            
            $("#indicator").html(newArray.length + ' online');
        },
        __getOldArray: function() {
            var oldArray = [];
            $("#users_list li").each(function() {
                oldArray.push($(this).html());
            });
            oldArray = oldArray.sort();
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
            return 'chat.php?name=' + encodeURIComponent(this.name);
        },
        __getURLUsers: function() {
            return 'users.php?name=' + encodeURIComponent(this.name);
        },
        init: function() {
            // Initialize Server-Sent Events service
            //if (!!window.EventSource) {
                var source = new EventSource(this.__getURL());
                var source_users = new EventSource(this.__getURLUsers());
                
                // Add event handlers
                source_users.addEventListener('users', function(e) {
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
                $("#chat_input_content").keypress(function(e) {// If the enter key is pressed
                    if (e.which == 13) {
                        // Get the current message
                        var message = $("#chat_input_content").val();
                        
                        // Send the message
                        ui.chat.message.send(message);
                        
                        // Clear the message from the input field
                        $("#chat_input_content").val("");
                    } else {
                        // Send a typing notification, at most once a second
                        ui.chat.typingNotification.send();
                    }
                });
                
                // Update the typing notifications once
                ui.chat.typingNotification.__update();
            //} else {
            //    alert("Sorry, your browser does not support real-time chat. Enjoy the music!");
            ///}
            
            // Set focus to the chat box
            $("#chat_input_content").focus();
        },
        message: {
            display: function(name, message) {
                message = unescape(message);
                var html = '<div class="chat_history_item"><span class="chat_history_item_name"></span><span class="chat_history_item_message"></span></div>';
                $(html).insertBefore("#chat_history_typing").css({'opacity': 0}).animate({'opacity': 1}, 50);
                $('.chat_history_item:last .chat_history_item_name').text(name);
                $('.chat_history_item:last .chat_history_item_message').text(message);
                
                // Remove any typing notification from this user
                ui.chat.typingNotification.remove(name);
                
                // Scroll the chat history
                $("#chat_history").scrollTo('max');
            },
            send: function(message) {
                if (message != '') {
                    $.post(ui.chat.__getURL(), {'message': escape(message)});
                }
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
                        $("#chat_history_typing").html("").stop(true).animate({'opacity': '0', 'height': '0'}, 50);
                        this.__hidden = true;
                    }
                } else {
                    var names = [];
                    for (var item in this.__current) {
                        if (this.__current.hasOwnProperty(item)) {
                            names.push(item);
                        }
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
                        $("#chat_history_typing").stop(true).css({'height': '20px'}).animate({'opacity': '1'}, 50);
                        this.__hidden = false;
                    }
                }
                
                // Scroll the chat history
                $("#chat_history").scrollTo('max');
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
        init: function() {
            this.volume.init();
        },
        nowplaying: {
            update: function(title) {
                $("#nowplaying_song").animate({opacity: 0}, 200, function() {
                    $(this).html(title).animate({opacity: 1}, 200);
                });
            },
        },
        progress: {
            update: function(progress) {
                // progress is a float between 0 and 1 indicating the percentage of the video which has elapsed
                progress = (progress * 100) + "%";
                $("#progressbar_inner").css({width: progress});
            }
        },
        volume: {
            init: function() {
                $("#volumebar_handle").draggable({'axis': 'x', 'containment': 'parent', 'drag': function(e, ui) {
                    var left = $(this).css('left');
                    left = left.substr(0, left.length-2);
                    drivers.music.setVolume(left / 100);
                }});
            }
        }
    },
    player: {
        __eventData: {},
        init: function() {
            // Get event information
            $.getJSON(ui.__eventUrl + '?' + Date.now(), function(eventData) {
                console.log("Got event information");
                ui.player.__eventData = eventData;
                
                // Display event title
                $("#event_title").html(' - ' + eventData.title);
                
                // Load current event playlist
                ui.playlist.__url = eventData.playlist;
                ui.playlist.init(function() {
                    console.log("Loaded playlist");
                    // Sync time with server
                    $.get("time.txt?" + Date.now(), function(data, text, xhr) {
                        var dateStr = xhr.getResponseHeader('Date');
                        var serverTime = Date.parse(new Date(Date.parse(dateStr)).toUTCString()) / 1000;
                        
                        // Use event start time to calculate current position in playlist
                        var startTime = ui.player.__eventData.startTime;
                        var timelinePosition = serverTime - startTime;
                        
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
            
            // Update the now playing indicator
            ui.controls.nowplaying.update(songs[index].title);
            
            // Update the currently playing song in the playlist display
            ui.playlist.setCurrent(songs[index].title);
        },
        end: function() {
            return;
        }
    },
    prompt: function(title, inital_value) {
        var this_class = this;
        var callback = function() {}
        
        // Setup prompt modal
        var html = '<div class="prompt_modal"><div class="prompt"><div class="prompt_title"></div><input class="prompt_input"></input></div></div>';
        this.$ = $(html);
        this.$.find('.prompt_title').html(title);
        this.$.find('.prompt_input').attr('value', inital_value);
        this.$.css({'display': 'none'}).appendTo('body');
        
        // Attach event handler to input box
        this.$.find('.prompt_input').keypress(function(e) {
            // If the enter key was pressed:
            if (e.which == 13) {
                var data = $(this).attr('value');
                this_class.hide();
                callback(data);
            }
        });
        
        this.onSubmit = function(newCallback) {
            callback = newCallback;
        }
        
        this.show = function() {
            // Show prompt modal
            this.$.css({'display': 'block'});
            this.$.find('.prompt').css({'margin-top': '-150px'}).animate({'margin-top': '-100px'}, 200);
            this.$.find('.prompt_modal').css({'opacity': 0}).animate({'opacity': 1}, 200);
            this.$.find('.prompt_input').focus();
        }
        
        this.hide = function() {
            // Hide prompt modal
            this.$.find('.prompt').animate({'margin-top': '-50px'}, 200);
            this.$.animate({'opacity': 0}, 200, function() {
                $(this).css({'display': 'none'});
            });
        }
    }
}

var drivers = {
    music: {
        __player: null,
        __firstPlay: true,
        __progressUpdater: null,
        __currentSong: null,
        play: function(song, time) {
            this.__currentSong = song;
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
                            e.target.seekTo(time, true);
                            drivers.music.__progressUpdater = window.setInterval(function() {
                                drivers.music.updateProgress();
                            }, 200);
                        },
                        'onStateChange': function(e) {
                            if (drivers.music.__firstPlay && e.data == 1) {
                                e.target.seekTo(time, true);
                                drivers.music.__firstPlay = false;
                            }
                            if (e.data == YT.PlayerState.PAUSED) {
                                e.target.playVideo();
                            }
                        }
                    }
                });
            } else {
                this.__player.loadVideoById(song.id);
            }
        },
        updateProgress: function() {
            var currentTime = drivers.music.__player.getCurrentTime();
            var progress = currentTime / drivers.music.__currentSong.duration;
            if (progress > 1) {
                progress = 1;
            }
            
            ui.controls.progress.update(progress);
        },
        setVolume: function(volume) {
            // volume is a float between 0 and 1 specifying the desired volume percentage
            
            volume = Math.floor(volume * 100);
            drivers.music.__player.setVolume(volume);
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
