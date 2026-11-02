-- step 1 npm start 
--step 2 
PS D:\Project 26X\DepDevFlow> Invoke-WebRequest -Uri "http://localhost:8081/login" -UseBasicParsing
Invoke-RestMethod http://localhost:4040/api/tunnels
--step 3


run to setup 
terminal 1
to check status 
Invoke-WebRequest http://localhost:8081/login -UseBasicParsing |
    Select-Object StatusCode

jenkins check up
Get-Service *jenkins*

terminal 2 
ngrok http 8081

 another terminal 
 Invoke-RestMethod http://localhost:4040/api/tunnels (to chk tunnek status )
terminal 3 
npm start