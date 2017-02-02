// triangulation using https://github.com/ironwallaby/delaunay

const TWO_PI = Math.PI * 2;

var images = [],
    imageIndex = 0;

var image,
    imageWidth = 415,
    imageHeight = 640;

var vertices = [],
    indices = [],
    fragments = [];

var container = document.getElementById('container');

var clickPosition = [imageWidth * 0.5, imageHeight * 0.5];

var shaker = new Shake({
    threshold: 6, // optional shake strength threshold
    timeout: 500 // optional, determines the frequency of event generation
});

window.onload = function() {
    shaker.start();

    TweenMax.set(container, {perspective:500});

    // images from reddit/r/wallpapers
    var urls = [
            'http://c-raine.com/wp-content/uploads/2014/03/IMG_4048.jpg',
            'http://c-raine.com/wp-content/uploads/2013/11/IMG_0374.jpg',
            'http://c-raine.com/wp-content/uploads/2013/11/IMG_0370.jpg',
            'https://s-media-cache-ak0.pinimg.com/736x/b3/10/c4/b310c49ada739d4fce95e74467dcbb06.jpg'
            // 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/175711/crayon.jpg',
            // 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/175711/spaceship.jpg',
            // 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/175711/dj.jpg',
            // 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/175711/chicken.jpg'
        ],
        image,
        loaded = 0;
    // very quick and dirty hack to load and display the first image asap
    images[0] = image = new Image();
        image.onload = function() {
            if (++loaded === 1) {
                imagesLoaded();
                for (var i = 1; i < urls.length; i++) {
                    images[i] = image = new Image();

                    image.src = urls[i];
                }
            }
        };
        image.src = urls[0];
};

function imagesLoaded() {
    placeImage(false);
    triangulate();
    shatter(enableSelectMode);
}

function placeImage(transitionIn) {
    image = images[imageIndex];

    if (++imageIndex === images.length) imageIndex = 0;

    image.addEventListener('click', imageClickHandler);
    container.appendChild(image);

    if (transitionIn !== false) {
        TweenMax.fromTo(image, 0.75, {y:-1000, rotationX: -180, rotationY: -90}, {y:0, rotationX: 0, rotationY: 0, ease:Back.easeOut});
    }

    window.scrollTop = 0;
}

function imageClickHandler(event) {
    var box = image.getBoundingClientRect(),
        top = box.top,
        left = box.left;

    clickPosition[0] = event.clientX - left;
    clickPosition[1] = event.clientY - top;

    triangulate();
    shatter();
}

function triangulate() {
    var rings = [
            {r:50, c:12},
            {r:150, c:12},
            {r:300, c:12},
            {r:1200, c:12} // very large in case of corner clicks
        ],
        x,
        y,
        centerX = clickPosition[0],
        centerY = clickPosition[1];

    vertices.push([centerX, centerY]);

    rings.forEach(function(ring) {
        var radius = ring.r,
            count = ring.c,
            variance = radius * 0.25;

        for (var i = 0; i < count; i++) {
            x = Math.cos((i / count) * TWO_PI) * radius + centerX + randomRange(-variance, variance);
            y = Math.sin((i / count) * TWO_PI) * radius + centerY + randomRange(-variance, variance);
            vertices.push([x, y]);
        }
    });

    vertices.forEach(function(v) {
        v[0] = clamp(v[0], 0, imageWidth);
        v[1] = clamp(v[1], 0, imageHeight);
    });

    indices = Delaunay.triangulate(vertices);
}

function shatter(callback) {
    var p0, p1, p2,
        fragment;

    var tl0 = new TimelineMax({
      onStart: playSmashSound,
      onComplete: function() {
        shatterCompleteHandler(callback);
      }
    });

    for (var i = 0; i < indices.length; i += 3) {
        p0 = vertices[indices[i + 0]];
        p1 = vertices[indices[i + 1]];
        p2 = vertices[indices[i + 2]];

        fragment = new Fragment(p0, p1, p2);

        var dx = fragment.centroid[0] - clickPosition[0],
            dy = fragment.centroid[1] - clickPosition[1],
            d = Math.sqrt(dx * dx + dy * dy),
            rx = 30 * sign(dy),
            ry = 90 * -sign(dx),
            delay = d * 0.003 * randomRange(0.9, 1.1);
        fragment.canvas.style.zIndex = Math.floor(d).toString();

        var tl1 = new TimelineMax();


        tl1.to(fragment.canvas, 1, {
            z:-500,
            rotationX:rx,
            rotationY:ry,
            ease:Cubic.easeIn
        });
        tl1.to(fragment.canvas, 0.4,{alpha:0}, 0.6);

        tl0.insert(tl1, delay);

        fragments.push(fragment);
        container.appendChild(fragment.canvas);
    }

    container.removeChild(image);
    image.removeEventListener('click', imageClickHandler);
}

function shatterCompleteHandler(callback) {
    // add pooling?
    fragments.forEach(function(f) {
        container.removeChild(f.canvas);
    });
    fragments.length = 0;
    vertices.length = 0;
    indices.length = 0;

    document.body.className = 'points-revealed';

    callback && callback();
}

//////////////
// MATH UTILS
//////////////

function randomRange(min, max) {
    return min + (max - min) * Math.random();
}

function clamp(x, min, max) {
    return x < min ? min : (x > max ? max : x);
}

function sign(x) {
    return x < 0 ? -1 : 1;
}

//////////////
// FRAGMENT
//////////////

Fragment = function(v0, v1, v2) {
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;

    this.computeBoundingBox();
    this.computeCentroid();
    this.createCanvas();
    this.clip();
};
Fragment.prototype = {
    computeBoundingBox:function() {
        var xMin = Math.min(this.v0[0], this.v1[0], this.v2[0]),
            xMax = Math.max(this.v0[0], this.v1[0], this.v2[0]),
            yMin = Math.min(this.v0[1], this.v1[1], this.v2[1]),
            yMax = Math.max(this.v0[1], this.v1[1], this.v2[1]);

        this.box ={
            x:xMin,
            y:yMin,
            w:xMax - xMin,
            h:yMax - yMin
        };
    },
    computeCentroid:function() {
        var x = (this.v0[0] + this.v1[0] + this.v2[0]) / 3,
            y = (this.v0[1] + this.v1[1] + this.v2[1]) / 3;

        this.centroid = [x, y];
    },
    createCanvas:function() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.box.w;
        this.canvas.height = this.box.h;
        this.canvas.style.width = this.box.w + 'px';
        this.canvas.style.height = this.box.h + 'px';
        this.canvas.style.left = this.box.x + 'px';
        this.canvas.style.top = this.box.y + 'px';
        this.ctx = this.canvas.getContext('2d');
    },
    clip:function() {
        this.ctx.translate(-this.box.x, -this.box.y);
        this.ctx.beginPath();
        this.ctx.moveTo(this.v0[0], this.v0[1]);
        this.ctx.lineTo(this.v1[0], this.v1[1]);
        this.ctx.lineTo(this.v2[0], this.v2[1]);
        this.ctx.closePath();
        this.ctx.clip();
        this.ctx.drawImage(image, 0, 0);
    }
};

window.onresize = function() {
    window.scrollTop = 0;
};

function changeNumber (value) {
  document.body.setAttribute('story-points', value);
  document.body.className = '';
  placeImage();
}

function enableSelectMode() {
  document.body.className = 'select-on';
}

function bodyClickHandler() {
  if (document.body.className === 'points-revealed') {
    enableSelectMode();
  }
}

window.addEventListener('shake', shakeEventDidOccur, false);

//function to call when shake occurs
function shakeEventDidOccur () {
  if (document.body.className === 'select-on') {
    return;
  }

  if (document.body.className === 'points-revealed') {
    enableSelectMode();
  } else {
    imageClickHandler({
      clientX: Math.random() * imageWidth,
      clientY: Math.random() * imageHeight
    });
  }
}

function playSmashSound() {
    document.getElementById('smash').play();
}