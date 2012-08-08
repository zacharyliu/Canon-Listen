var ui = {
    playlist: {
        importData: function(data) {
            for (section in data) {
                var html = '<div class="playlist_header">' + section.title + '</div>';
                $("#playlist").append(html);
                var html = '<ul class="playlist_items">';
                for (song in section) {
                    var html = '<li>' + song.title + '</li>';
                    $("#playlist").append(html);
                }
                var html = '</ul>';
                $("#playlist").append(html);
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
        }
    },
    users: {
        refresh: function(newArray) {
            var results = this.__search(this.__getOldArray(), newArray);
            for (item in results.remove) {
                this.__remove(item.index);
            }
            for (item in results.add) {
                this.__add(item.index, item.name);
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
                }
                i++;
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
                    results.add.push({index: index, item: item});
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
            if (index < $("#users_list li").length) {
                $("#users_list li:not(.animating)").eq(index).before($object);
            } else {
                $("#users_list").append($object);
            }
            $object.animate({height: 'auto', opacity: 1}, 500, function(){
                $(this).removeClass('animating');
            });
        },
        __remove: function(index) {
            $("#users_list li:not(.animating)").eq('index').addClass('animating').animate({height: 0, opacity: 0}, 500, function() {
                $(this).remove();
            });
        }
        
    },
    chat: {
        
    },
    controls: {
        
    }
}
