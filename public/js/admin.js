
$(document).ready(function() {
    $('form-signin').submit(function (e) {
        e.preventDefault();
        window.open('admin_console.html');
        //if($('email').val() === "admin@ep.com" && $('password').val() == "points") {
            //window.open('admin_console.html');
        //}
        //this.reset();
    });
});

