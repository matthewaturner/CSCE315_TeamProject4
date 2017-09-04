
// Toggles mobile navbar when item selected
$('.navbar-collapse ul li a').click(function() {
    $('.navbar-toggle:visible').click();
});

$(document).ready(function() {
    $('form').submit(function (e) {
        e.preventDefault();
        $.get('/points/' + $('#input-name').val(), {}, printPoints);
        //$.post('/points', {name: $('#input-name').val()}, printPoints);
        //this.reset();
        $('#name-form').hide();
        $('#point-totals').show();
    });
});

function printPoints(data) {
    for(var category in data) {
        if(data[category].goal <= 0) {
            width = 100;
        } else {
            var width = Math.min((data[category].points+1) / (data[category].goal+1) * 100, 100);
        }
        document.getElementById("point-totals").innerHTML += `${category}<div class="progress" style="background-color:grey">
  <div class="progress-bar" role="progressbar" aria-valuenow="${data[category].points}"
  aria-valuemin="0" aria-valuemax="${data[category].goal}" style="width:${width}%">
    ${data[category].points}/${data[category].goal}
  </div>
</div>`;
    };

    //document.getElementById("pointText").innerHTML = JSON.stringify(data);
    console.log("Data received: ", JSON.stringify(data));
};
