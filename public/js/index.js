
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
    document.getElementById("pointText").innerHTML = JSON.stringify(data);
    console.log("Data received: ", JSON.stringify(data));
};
