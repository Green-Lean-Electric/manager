# Manager
Basic functionality

The Manager application has functionalities similar to the Prosumer. A Manager should be able to:

Through a profile page update credentials and delete his/her account. A picture of the Manager must be uploaded and shown in the profile
See and control the Coal Power plant’s electricity production
See the Coal Power plant’s status: starting, running, stopped
When producing, control a ratio of electricity being sent to the buffer and to the market (when stopped the buffer should be used to supply the market demand)
See the current Market demand
Have a list of a Prosumers from which the Manager can:
Be able to see who is online (logged in)
Be able to view this Prosumer’s system
Block the Prosumer from selling to the market for (10-100 seconds)



Advanced functionality

Here are some suggestions in order to obtain a higher grade:

Add IP and port to the list of Prosumers (and other interesting/useful information e.g. last login)
User interface is not “polling” over REST, but instead streams data over e.g. a socket
Monitoring and displaying network delays in the system
Introduce different useful alarms 
Make a bot that can replace the Manager - Monitors values, redirects to buffer or market,sends messages to users etc.
Should be able to use from multiple devices e.g. desktop and mobile (responsive)
Should be able to use simultaneously from multiple devices
An “notification” field or chat where messages from a Prosumer can be received
There is a visual representation (e.g. Gauges) of the different values and graphical tools (e.g. sliders etc) for controlling the plant
Messages from Providers can be given a priority and one could add filters for low, medium, high. Also each message has an acknowledge button. The messages must not suffer from XSS vulnerabilities etc.
The operator can re-order the visual gauges for example using drag-n-drop
Push-to-talk button for contacting a Prosumer over voice, or even a video function
Perform dead reckoning of the system to save data traffic (e.g. broadcast operator commands/data to all connected to the plant and then dead reckon the state of the system. Eventual corrections with real data is needed).
