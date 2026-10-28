let 指令 = ""
let 力道 = 0
let 最大力道 = 0
bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})
bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.Hash), function () {
    指令 = bluetooth.uartReadUntil(serial.delimiters(Delimiters.Hash))
    if (指令 == "good") {
        basic.showIcon(IconNames.Happy)
    } else if (指令 == "miss") {
        basic.showIcon(IconNames.Sad)
    }
})
bluetooth.startUartService()
basic.showIcon(IconNames.No)
basic.forever(function () {
    力道 = input.acceleration(Dimension.Strength)
    if (力道 > 1500) {
        if (力道 > 最大力道) {
            最大力道 = 力道
        }
    } else if (最大力道 > 0) {
        bluetooth.uartWriteValue("s", 最大力道)
        最大力道 = 0
    }
    bluetooth.uartWriteValue("x", input.acceleration(Dimension.X))
    basic.pause(50)
})
