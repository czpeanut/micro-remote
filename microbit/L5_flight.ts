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
    } else if (指令 == "ring") {
        basic.showIcon(IconNames.Target)
    } else if (指令 == "crash") {
        basic.showIcon(IconNames.Skull)
    } else if (指令 == "end") {
        basic.showIcon(IconNames.Happy)
    }
})
bluetooth.startUartService()
basic.showIcon(IconNames.No)
basic.forever(function () {
    bluetooth.uartWriteValue("x", input.acceleration(Dimension.X))
    bluetooth.uartWriteValue("y", input.acceleration(Dimension.Y))
    距離 = sonar.ping(DigitalPin.P15, DigitalPin.P15, PingUnit.Centimeters)
    bluetooth.uartWriteValue("d", 距離)
    basic.pause(100)
})
