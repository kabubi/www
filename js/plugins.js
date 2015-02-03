'use strict';
angular.module('ngAudio', [])
.directive('ngAudio', ['$compile', '$q', 'ngAudio', function($compile, $q, ngAudio) {
    return {
        restrict: 'AEC',
        scope: {
            volume: '=',
            start: '=',
            currentTime: '=',
            loop: '=',
            clickPlay: '='
        },
        controller: function($scope, $attrs, $element, $timeout) {

            var audio = ngAudio.load($attrs.ngAudio);
            $scope.$audio = audio;
            // audio.unbind();
            
            $element.on('click', function() {
                if ($scope.clickPlay === false) {
                    return;
                }

                audio.audio.play();
                
                audio.volume = $scope.volume || audio.volume;
                audio.loop = $scope.loop;
                audio.currentTime = $scope.start || 0;

                $timeout(function() {
                    audio.play();
                }, 5);
            });
        }
    };
}])

.service('localAudioFindingService', ['$q', function($q) {

    this.find = function(id) {
        var deferred = $q.defer();
        var $sound = document.getElementById(id);
        if ($sound) {
            deferred.resolve($sound);
        } else {
            deferred.reject(id);
        }

        return deferred.promise;
    };
}])

.service('remoteAudioFindingService', ['$q', function($q) {

    this.find = function(url) {
        var deferred = $q.defer();
        var audio = new Audio();

        audio.addEventListener('error', function() {
            deferred.reject();
        });

        audio.addEventListener('loadstart', function() {
            deferred.resolve(audio);
        });

        // bugfix for chrome...
        setTimeout(function() {
            audio.src = url;
        }, 1);

        return deferred.promise;

    };
}])

.service('cleverAudioFindingService', ['$q', 'localAudioFindingService', 'remoteAudioFindingService', function($q, localAudioFindingService, remoteAudioFindingService) {
    this.find = function(id) {
        var deferred = $q.defer();

        id = id.replace('|', '/');

        localAudioFindingService.find(id)
            .then(deferred.resolve, function() {
                return remoteAudioFindingService.find(id);
            })
            .then(deferred.resolve, deferred.reject);

        return deferred.promise;
    };
}])

.value('ngAudioGlobals', {
    muting: false,
    songmuting: false
})

.factory('NgAudioObject', ['cleverAudioFindingService', '$rootScope', '$interval', '$timeout', 'ngAudioGlobals', function(cleverAudioFindingService, $rootScope, $interval, $timeout, ngAudioGlobals) {
    return function(id) {

        window.addEventListener("click",function twiddle(){
            audio.play();
            audio.pause();
            window.removeEventListener("click",twiddle);
        });


        var $audioWatch,
            $willPlay = false,
            $willPause = false,
            $willRestart = false,
            $volumeToSet,
            $looping,
            $isMuting = false,
            $observeProperties = true,
            audio,
            audioObject = this;

        this.id = id;
        this.safeId = id.replace('/', '|');
        this.loop = 0;

        this.unbind = function() {
            $observeProperties = false;
        };

        this.play = function() {
            $willPlay = true;
        };

        this.pause = function() {
            $willPause = true;
        };

        this.restart = function() {
            $willRestart = true;
        };

        this.stop = function() {
            this.restart();
        };

        this.setVolume = function(volume) {
            $volumeToSet = volume;
        };

        this.setMuting = function(muting) {
            $isMuting = muting;
        };

        this.setProgress = function(progress) {
            if (audio && audio.duration) {
                audio.currentTime = audio.duration * progress;
            }
        };

        this.setCurrentTime = function(currentTime) {
            if (audio && audio.duration) {
                audio.currentTime = currentTime;
            }
        };

        function $setWatch() {
            $audioWatch = $rootScope.$watch(function() {
                return {
                    volume: audioObject.volume,
                    currentTime: audioObject.currentTime,
                    progress: audioObject.progress,
                    muting: audioObject.muting,
                    loop: audioObject.loop,
                };
            }, function(newValue, oldValue) {
                if (newValue.currentTime !== oldValue.currentTime) {
                    audioObject.setCurrentTime(newValue.currentTime);
                }

                if (newValue.progress !== oldValue.progress) {
                    audioObject.setProgress(newValue.progress);
                }
                if (newValue.volume !== oldValue.volume) {
                    audioObject.setVolume(newValue.volume);
                }

                if (newValue.volume !== oldValue.volume) {
                    audioObject.setVolume(newValue.volume);
                }

                $looping = newValue.loop;

                if (newValue.muting !== oldValue.muting) {
                    audioObject.setMuting(newValue.muting);
                }
            }, true);
        }

        cleverAudioFindingService.find(id)
            .then(function(nativeAudio) {
                audio = nativeAudio;
                audio.addEventListener('waiting', function() {
                    audioObject.isWaiting = true;
                });
                audio.addEventListener('canplay', function() {
                    audioObject.canPlay = true;
                });
                audio.addEventListener('playing', function() {
                    audioObject.isPlaying = true;
                });
            }, function(error) {
                audioObject.error = true;
                console.warn(error);
            });


        $interval(function() {
            if ($audioWatch) {
                $audioWatch();
            }
            if (audio) {

                if ($isMuting || ngAudioGlobals.isMuting) {
                    audio.volume = 0;
                } else {
                    audio.volume = audioObject.volume !== undefined ? audioObject.volume : 1;
                }

                if ($willPlay) {
                    audio.play();
                    $willPlay = false;
                }

                if ($willRestart) {
                    audio.pause();
                    audio.currentTime = 0;
                    $willRestart = false;
                }

                if ($willPause) {
                    audio.pause();
                    $willPause = false;
                }

                if ($volumeToSet) {
                    audio.volume = $volumeToSet;
                    $volumeToSet = undefined;
                }

                if ($observeProperties) {
                    audioObject.currentTime = audio.currentTime;
                    audioObject.duration = audio.duration;
                    audioObject.remaining = audio.duration - audio.currentTime;
                    audioObject.progress = audio.currentTime / audio.duration;
                    audioObject.paused = audio.paused;
                    audioObject.src = audio.src;

                    if ($looping && audioObject.currentTime === audioObject.duration) {
                        if ($looping !== true) {
                            $looping--;
                            audioObject.loop--;
                            // if (!$looping) return;
                        }
                        audioObject.setCurrentTime(0);
                        audioObject.play();

                    }
                }

                if (!$isMuting && !ngAudioGlobals.isMuting) {
                    audioObject.volume = audio.volume;
                }

                audioObject.audio = audio;
            }

            $setWatch();
        }, 25);
    };
}])
.service('ngAudio', ['NgAudioObject', 'ngAudioGlobals', function(NgAudioObject, ngAudioGlobals) {
    this.play = function(id) {

        var audio = new NgAudioObject(id);
        audio.play();
        return audio;
    };

    this.load = function(id) {
        return new NgAudioObject(id);
    };

    this.mute = function() {
        ngAudioGlobals.muting = true;
    };

    this.unmute = function() {
        ngAudioGlobals.muting = false;
    };

    this.toggleMute = function() {
        ngAudioGlobals.muting = !ngAudioGlobals.muting;
    };
}]);

/**
 * Angularjs-Google-Maps
 * @version v1.1.0 
 * @link https://github.com/allenhwkim/angularjs-google-maps
 * @author allenhwkim
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */

var ngMap=angular.module("ngMap",[]);ngMap.service("Attr2Options",["$parse","NavigatorGeolocation","GeoCoder",function($parse,NavigatorGeolocation,GeoCoder){var SPECIAL_CHARS_REGEXP=/([\:\-\_]+(.))/g,MOZ_HACK_REGEXP=/^moz([A-Z])/,orgAttributes=function(e){e.length>0&&(e=e[0]);for(var t={},n=0;n<e.attributes.length;n++){var r=e.attributes[n];t[r.name]=r.value}return t},camelCase=function(e){return e.replace(SPECIAL_CHARS_REGEXP,function(e,t,n,r){return r?n.toUpperCase():n}).replace(MOZ_HACK_REGEXP,"Moz$1")},JSONize=function(e){try{return JSON.parse(e),e}catch(t){return e.replace(/([\$\w]+)\s*:/g,function(e,t){return'"'+t+'":'}).replace(/'([^']+)'/g,function(e,t){return'"'+t+'"'})}},toOptionValue=function(input,options){var output,key=options.key,scope=options.scope;try{var num=Number(input);if(isNaN(num))throw"Not a number";output=num}catch(err){try{if(input.match(/^[\+\-]?[0-9\.]+,[ ]*\ ?[\+\-]?[0-9\.]+$/)&&(input="["+input+"]"),output=JSON.parse(JSONize(input)),output instanceof Array){var t1stEl=output[0];if(t1stEl.constructor==Object);else if(t1stEl.constructor==Array)output=output.map(function(e){return new google.maps.LatLng(e[0],e[1])});else if(!isNaN(parseFloat(t1stEl))&&isFinite(t1stEl))return new google.maps.LatLng(output[0],output[1])}}catch(err2){if(input.match(/^[A-Z][a-zA-Z0-9]+\(.*\)$/))try{var exp="new google.maps."+input;output=eval(exp)}catch(e){output=input}else if(input.match(/^([A-Z][a-zA-Z0-9]+)\.([A-Z]+)$/))try{var matches=input.match(/^([A-Z][a-zA-Z0-9]+)\.([A-Z]+)$/);output=google.maps[matches[1]][matches[2]]}catch(e){output=input}else if(input.match(/^[A-Z]+$/))try{var capitalizedKey=key.charAt(0).toUpperCase()+key.slice(1);key.match(/temperatureUnit|windSpeedUnit|labelColor/)?(capitalizedKey=capitalizedKey.replace(/s$/,""),output=google.maps.weather[capitalizedKey][input]):output=google.maps[capitalizedKey][input]}catch(e){output=input}else output=input}}return output},setDelayedGeoLocation=function(e,t,n,r){r=r||{};var a=e.centered||r.centered,o=function(){var n=r.fallbackLocation||new google.maps.LatLng(0,0);e[t](n)};!n||n.match(/^current/i)?NavigatorGeolocation.getCurrentPosition().then(function(n){var r=n.coords.latitude,o=n.coords.longitude,i=new google.maps.LatLng(r,o);e[t](i),a&&e.map.setCenter(i)},o):GeoCoder.geocode({address:n}).then(function(n){e[t](n[0].geometry.location),a&&e.map.setCenter(n[0].geometry.location)},o)},getAttrsToObserve=function(e){var t=[];if(e["ng-repeat"]||e.ngRepeat);else for(var n in e){var r=e[n];r&&r.match(/\{\{.*\}\}/)&&t.push(camelCase(n))}return t},observeAttrSetObj=function(e,t,n){var r=getAttrsToObserve(e);Object.keys(r).length;for(var a=0;a<r.length;a++)observeAndSet(t,r[a],n)},observeAndSet=function(e,t,n){e.$observe(t,function(e){if(e){var r=camelCase("set-"+t),a=toOptionValue(e,{key:t});n[r]&&(t.match(/center|position/)&&"string"==typeof a?setDelayedGeoLocation(n,r,a):n[r](a))}})};return{filter:function(e){var t={};for(var n in e)n.match(/^\$/)||n.match(/^ng[A-Z]/)||(t[n]=e[n]);return t},getOptions:function(e,t){var n={};for(var r in e)if(e[r]){if(r.match(/^on[A-Z]/))continue;if(r.match(/ControlOptions$/))continue;n[r]=toOptionValue(e[r],{scope:t,key:r})}return n},getEvents:function(e,t){var n={},r=function(e){return"_"+e.toLowerCase()},a=function(t){var n=t.match(/([^\(]+)\(([^\)]*)\)/),r=n[1],a=n[2].replace(/event[ ,]*/,""),o=e.$eval("["+a+"]");return function(t){e[r].apply(this,[t].concat(o)),e.$apply()}};for(var o in t)if(t[o]){if(!o.match(/^on[A-Z]/))continue;var i=o.replace(/^on/,"");i=i.charAt(0).toLowerCase()+i.slice(1),i=i.replace(/([A-Z])/g,r);var s=t[o];n[i]=new a(s)}return n},getControlOptions:function(e){var t={};if("object"!=typeof e)return!1;for(var n in e)if(e[n]){if(!n.match(/(.*)ControlOptions$/))continue;var r=e[n],a=r.replace(/'/g,'"');a=a.replace(/([^"]+)|("[^"]+")/g,function(e,t,n){return t?t.replace(/([a-zA-Z0-9]+?):/g,'"$1":'):n});try{var o=JSON.parse(a);for(var i in o)if(o[i]){var s=o[i];if("string"==typeof s?s=s.toUpperCase():"mapTypeIds"===i&&(s=s.map(function(e){return e.match(/^[A-Z]+$/)?google.maps.MapTypeId[e.toUpperCase()]:e})),"style"===i){var p=n.charAt(0).toUpperCase()+n.slice(1),c=p.replace(/Options$/,"")+"Style";o[i]=google.maps[c][s]}else o[i]="position"===i?google.maps.ControlPosition[s]:s}t[n]=o}catch(l){}}return t},toOptionValue:toOptionValue,camelCase:camelCase,setDelayedGeoLocation:setDelayedGeoLocation,getAttrsToObserve:getAttrsToObserve,observeAndSet:observeAndSet,observeAttrSetObj:observeAttrSetObj,orgAttributes:orgAttributes}}]),ngMap.service("GeoCoder",["$q",function(e){return{geocode:function(t){var n=e.defer(),r=new google.maps.Geocoder;return r.geocode(t,function(e,t){t==google.maps.GeocoderStatus.OK?n.resolve(e):n.reject("Geocoder failed due to: "+t)}),n.promise}}}]),ngMap.service("NavigatorGeolocation",["$q",function(e){return{getCurrentPosition:function(){var t=e.defer();return navigator.geolocation?navigator.geolocation.getCurrentPosition(function(e){t.resolve(e)},function(e){t.reject(e)}):t.reject("Browser Geolocation service failed."),t.promise},watchPosition:function(){return"TODO"},clearWatch:function(){return"TODO"}}}]),ngMap.service("StreetView",["$q",function(e){return{getPanorama:function(t,n){n=n||t.getCenter();var r=e.defer(),a=new google.maps.StreetViewService;return a.getPanoramaByLocation(n||t.getCenter,100,function(e,t){t===google.maps.StreetViewStatus.OK?r.resolve(e.location.pano):r.resolve(!1)}),r.promise},setPanorama:function(e,t){var n=new google.maps.StreetViewPanorama(e.getDiv(),{enableCloseButton:!0});n.setPano(t)}}}]),ngMap.directive("bicyclingLayer",["Attr2Options",function(e){var t=e,n=function(e,t){var n=new google.maps.BicyclingLayer(e);for(var r in t)google.maps.event.addListener(n,r,t[r]);return n};return{restrict:"E",require:"^map",link:function(e,r,a,o){var i=t.orgAttributes(r),s=t.filter(a),p=t.getOptions(s),c=t.getEvents(e,s),l=n(p,c);o.addObject("bicyclingLayers",l),t.observeAttrSetObj(i,a,l)}}}]),ngMap.directive("cloudLayer",["Attr2Options",function(e){var t=e,n=function(e,t){var n=new google.maps.weather.CloudLayer(e);for(var r in t)google.maps.event.addListener(n,r,t[r]);return n};return{restrict:"E",require:"^map",link:function(e,r,a,o){var i=t.orgAttributes(r),s=t.filter(a),p=t.getOptions(s),c=t.getEvents(e,s),l=n(p,c);o.addObject("cloudLayers",l),t.observeAttrSetObj(i,a,l)}}}]),ngMap.directive("customControl",["Attr2Options","$compile",function(e,t){var n=e;return{restrict:"E",require:"^map",link:function(e,r,a,o){r.css("display","none");var i=(n.orgAttributes(r),n.filter(a)),s=n.getOptions(i,e),p=n.getEvents(e,i),c=t(r.html().trim())(e),l=c[0];for(var u in p)google.maps.event.addDomListener(l,u,p[u]);o.addObject("customControls",l),e.$on("mapInitialized",function(e,t){var n=s.position;t.controls[google.maps.ControlPosition[n]].push(l)})}}}]),ngMap.directive("dynamicMapsEngineLayer",["Attr2Options",function(e){var t=e,n=function(e,t){var n=new google.maps.visualization.DynamicMapsEngineLayer(e);for(var r in t)google.maps.event.addListener(n,r,t[r]);return n};return{restrict:"E",require:"^map",link:function(e,r,a,o){var i=t.filter(a),s=t.getOptions(i),p=t.getEvents(e,i,p),c=n(s,p);o.addObject("mapsEngineLayers",c)}}}]),ngMap.directive("fusionTablesLayer",["Attr2Options",function(e){var t=e,n=function(e,t){var n=new google.maps.FusionTablesLayer(e);for(var r in t)google.maps.event.addListener(n,r,t[r]);return n};return{restrict:"E",require:"^map",link:function(e,r,a,o){var i=t.filter(a),s=t.getOptions(i),p=t.getEvents(e,i,p),c=n(s,p);o.addObject("fusionTablesLayers",c)}}}]),ngMap.directive("heatmapLayer",["Attr2Options","$window",function(e,t){var n=e;return{restrict:"E",require:"^map",link:function(e,r,a,o){var i=n.filter(a),s=n.getOptions(i);if(s.data=t[a.data]||e[a.data],!(s.data instanceof Array))throw"invalid heatmap data";s.data=new google.maps.MVCArray(s.data);{var p=new google.maps.visualization.HeatmapLayer(s);n.getEvents(e,i)}o.addObject("heatmapLayers",p)}}}]),ngMap.directive("infoWindow",["Attr2Options","$compile",function(e,t){var n=e,r=function(e,t){var r;if(e.position instanceof google.maps.LatLng)r=new google.maps.InfoWindow(e);else{var a=e.position;e.position=new google.maps.LatLng(0,0),r=new google.maps.InfoWindow(e),n.setDelayedGeoLocation(r,"setPosition",a)}Object.keys(t).length>0;for(var o in t)o&&google.maps.event.addListener(r,o,t[o]);return r};return{restrict:"E",require:"^map",link:function(e,a,o,i){a.css("display","none");var s=n.orgAttributes(a),p=n.filter(o),c=n.getOptions(p,e),l=n.getEvents(e,p),u=a.html().trim();if(1!=angular.element(u).length)throw"info-window working as a template must have a container";var g=r(c,l);g.template=u.replace(/ng-non-/,""),i.addObject("infoWindows",g),n.observeAttrSetObj(s,o,g),e.showInfoWindow=e.showInfoWindow||function(t,n,r){var a=i.map.infoWindows[n],o=a.template.trim(),s=o.replace(/{{([^}]+)}}/g,function(t,n){return e.$eval(n)});a.setContent(s),r?(a.setPosition(r),a.open(i.map)):this.getPosition?a.open(i.map,this):a.open(i.map)},g.visible&&e.$on("mapInitialized",function(){var n=t(g.template)(e);g.setContent(n.html()),g.open(i.map)}),g.visibleOnMarker&&e.$on("mapInitialized",function(){var n=i.map.markers[g.visibleOnMarker];if(!n)throw"Invalid marker id";var r=t(g.template)(e);g.setContent(r.html()),g.open(i.map,n)})}}}]),ngMap.directive("kmlLayer",["Attr2Options",function(e){var t=e,n=function(e,t){var n=new google.maps.KmlLayer(e);for(var r in t)google.maps.event.addListener(n,r,t[r]);return n};return{restrict:"E",require:"^map",link:function(e,r,a,o){var i=t.orgAttributes(r),s=t.filter(a),p=t.getOptions(s),c=t.getEvents(e,s),l=n(p,c);o.addObject("kmlLayers",l),t.observeAttrSetObj(i,a,l)}}}]),ngMap.directive("mapData",["Attr2Options",function(e){var t=e;return{restrict:"E",require:"^map",link:function(e,n,r){var a=t.filter(r),o=t.getOptions(a),i=t.getEvents(e,a,i);e.$on("mapInitialized",function(t,n){for(var r in o)if(r){var a=o[r];"function"==typeof e[a]?n.data[r](e[a]):n.data[r](a)}for(var s in i)i[s]&&n.data.addListener(s,i[s])})}}}]),ngMap.directive("mapType",["Attr2Options","$window",function(e,t){return{restrict:"E",require:"^map",link:function(e,n,r,a){var o,i=r.name;if(!i)throw"invalid map-type name";if(r.object){var s=e[r.object]?e:t;o=s[r.object],"function"==typeof o&&(o=new o)}if(!o)throw"invalid map-type object";e.$on("mapInitialized",function(e,t){t.mapTypes.set(i,o)}),a.addObject("mapTypes",o)}}}]),ngMap.directive("map",["Attr2Options","$timeout",function(e,t){function n(e,t){if(e.currentStyle)var n=e.currentStyle[t];else if(window.getComputedStyle)var n=document.defaultView.getComputedStyle(e,null).getPropertyValue(t);return n}var r=e;return{restrict:"AE",controller:ngMap.MapController,link:function(a,o,i,s){var p=r.orgAttributes(o);a.google=google;var c=document.createElement("div");c.style.width="100%",c.style.height="100%",o.prepend(c),"block"!=n(o[0],"display")&&o.css("display","block"),n(o[0],"height").match(/^0/)&&o.css("height","300px");var l=function(n,o){var l=new google.maps.Map(c,{});l.markers={},l.shapes={},t(function(){google.maps.event.trigger(l,"resize")}),n.zoom=n.zoom||15;var u=n.center;u instanceof google.maps.LatLng||(delete n.center,e.setDelayedGeoLocation(l,"setCenter",u,g.geoFallbackCenter)),l.setOptions(n);for(var m in o)m&&google.maps.event.addListener(l,m,o[m]);r.observeAttrSetObj(p,i,l),s.map=l,s.addObjects(s._objects),a.map=l,a.map.scope=a,a.$emit("mapInitialized",l),a.maps=a.maps||{},a.maps[g.id||Object.keys(a.maps).length]=l,a.$emit("mapsInitialized",a.maps)},u=r.filter(i),g=r.getOptions(u,a),m=r.getControlOptions(u),v=angular.extend(g,m),f=r.getEvents(a,u);i.initEvent?a.$on(i.initEvent,function(){!s.map&&l(v,f)}):l(v,f)}}}]),ngMap.MapController=function(){this.map=null,this._objects=[],this.addMarker=function(e){if(this.map){this.map.markers=this.map.markers||{},e.setMap(this.map),e.centered&&this.map.setCenter(e.position);var t=Object.keys(this.map.markers).length;this.map.markers[e.id||t]=e}else this._objects.push(e)},this.addShape=function(e){if(this.map){this.map.shapes=this.map.shapes||{},e.setMap(this.map);var t=Object.keys(this.map.shapes).length;this.map.shapes[e.id||t]=e}else this._objects.push(e)},this.addObject=function(e,t){if(this.map){this.map[e]=this.map[e]||{};var n=Object.keys(this.map[e]).length;this.map[e][t.id||n]=t,"infoWindows"!=e&&t.setMap&&t.setMap(this.map)}else t.groupName=e,this._objects.push(t)},this.addObjects=function(e){for(var t=0;t<e.length;t++){var n=e[t];n instanceof google.maps.Marker?this.addMarker(n):n instanceof google.maps.Circle||n instanceof google.maps.Polygon||n instanceof google.maps.Polyline||n instanceof google.maps.Rectangle||n instanceof google.maps.GroundOverlay?this.addShape(n):this.addObject(n.groupName,n)}}},ngMap.directive("mapsEngineLayer",["Attr2Options",function(e){var t=e,n=function(e,t){var n=new google.maps.visualization.MapsEngineLayer(e);for(var r in t)google.maps.event.addListener(n,r,t[r]);return n};return{restrict:"E",require:"^map",link:function(e,r,a,o){var i=t.filter(a),s=t.getOptions(i),p=t.getEvents(e,i,p),c=n(s,p);o.addObject("mapsEngineLayers",c)}}}]),ngMap.directive("marker",["Attr2Options",function(e){var t=e,n=function(e,n){var r;if(e.icon instanceof Object){(""+e.icon.path).match(/^[A-Z_]+$/)&&(e.icon.path=google.maps.SymbolPath[e.icon.path]);for(var a in e.icon){var o=e.icon[a];"anchor"==a||"origin"==a?e.icon[a]=new google.maps.Point(o[0],o[1]):("size"==a||"scaledSize"==a)&&(e.icon[a]=new google.maps.Size(o[0],o[1]))}}if(e.position instanceof google.maps.LatLng)r=new google.maps.Marker(e);else{var i=e.position;e.position=new google.maps.LatLng(0,0),r=new google.maps.Marker(e),t.setDelayedGeoLocation(r,"setPosition",i)}Object.keys(n).length>0;for(var s in n)s&&google.maps.event.addListener(r,s,n[s]);return r};return{restrict:"E",require:"^map",link:function(e,r,a,o){var i=t.orgAttributes(r),s=t.filter(a),p=t.getOptions(s,e),c=t.getEvents(e,s);r.bind("$destroy",function(){var e=l.map.markers;for(var t in e)e[t]==l&&delete e[t];l.setMap(null)});var l=n(p,c);o.addMarker(l),t.observeAttrSetObj(i,a,l)}}}]),ngMap.directive("overlayMapType",["Attr2Options","$window",function(e,t){return{restrict:"E",require:"^map",link:function(e,n,r,a){var o,i=r.initMethod||"insertAt";if(r.object){var s=e[r.object]?e:t;o=s[r.object],"function"==typeof o&&(o=new o)}if(!o)throw"invalid map-type object";e.$on("mapInitialized",function(e,t){if("insertAt"==i){var n=parseInt(r.index,10);t.overlayMapTypes.insertAt(n,o)}else"push"==i&&t.overlayMapTypes.push(o)}),a.addObject("overlayMapTypes",o)}}}]),ngMap.directive("shape",["Attr2Options",function(e){var t=e,n=function(e){return new google.maps.LatLngBounds(e[0],e[1])},r=function(e,r){var a,o=e.name;if(delete e.name,e.icons)for(var i=0;i<e.icons.length;i++){var s=e.icons[i];s.icon.path.match(/^[A-Z_]+$/)&&(s.icon.path=google.maps.SymbolPath[s.icon.path])}switch(o){case"circle":if(e.center instanceof google.maps.LatLng)a=new google.maps.Circle(e);else{var p=e.center;e.center=new google.maps.LatLng(0,0),a=new google.maps.Circle(e),t.setDelayedGeoLocation(a,"setCenter",p)}break;case"polygon":a=new google.maps.Polygon(e);break;case"polyline":a=new google.maps.Polyline(e);break;case"rectangle":e.bounds&&(e.bounds=n(e.bounds)),a=new google.maps.Rectangle(e);break;case"groundOverlay":case"image":var c=e.url,l=n(e.bounds),u={opacity:e.opacity,clickable:e.clickable,id:e.id};a=new google.maps.GroundOverlay(c,l,u)}for(var g in r)r[g]&&google.maps.event.addListener(a,g,r[g]);return a};return{restrict:"E",require:"^map",link:function(e,n,a,o){var i=t.orgAttributes(n),s=t.filter(a),p=t.getOptions(s),c=t.getEvents(e,s),l=r(p,c);o.addShape(l),t.observeAttrSetObj(i,a,l)}}}]),ngMap.directive("trafficLayer",["Attr2Options",function(e){var t=e,n=function(e,t){var n=new google.maps.TrafficLayer(e);for(var r in t)google.maps.event.addListener(n,r,t[r]);return n};return{restrict:"E",require:"^map",link:function(e,r,a,o){var i=t.orgAttributes(r),s=t.filter(a),p=t.getOptions(s),c=t.getEvents(e,s),l=n(p,c);o.addObject("trafficLayers",l),t.observeAttrSetObj(i,a,l)}}}]),ngMap.directive("transitLayer",["Attr2Options",function(e){var t=e,n=function(e,t){var n=new google.maps.TransitLayer(e);for(var r in t)google.maps.event.addListener(n,r,t[r]);return n};return{restrict:"E",require:"^map",link:function(e,r,a,o){var i=t.orgAttributes(r),s=t.filter(a),p=t.getOptions(s),c=t.getEvents(e,s),l=n(p,c);o.addObject("transitLayers",l),t.observeAttrSetObj(i,a,l)}}}]),ngMap.directive("weatherLayer",["Attr2Options",function(e){var t=e,n=function(e,t){var n=new google.maps.weather.WeatherLayer(e);for(var r in t)google.maps.event.addListener(n,r,t[r]);return n};return{restrict:"E",require:"^map",link:function(e,r,a,o){var i=t.orgAttributes(r),s=t.filter(a),p=t.getOptions(s),c=t.getEvents(e,s),l=n(p,c);o.addObject("weatherLayers",l),t.observeAttrSetObj(i,a,l)}}}]);