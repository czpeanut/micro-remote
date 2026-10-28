let 指令 = ""
let 距離 = 0
bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})
bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.Hash), function () {
    指令 = bluetooth.uartReadUntil(serial.delimiters(Delimiters.Hash))
    if (指令 == "star") {
        basic.showIcon(IconNames.Diamond)
    } else if (指令 == "hit") {
        basic.showIcon(IconNames.Skull)
    }
})
bluetooth.startUartService()
basic.showIcon(IconNames.No)
basic.forever(function () {
    距離 = sonar.ping(DigitalPin.P15, DigitalPin.P15, PingUnit.Centimeters)
    bluetooth.uartWriteValue("d", 距離)
    led.plotBarGraph(距離, 40)
    basic.pause(100)
})
