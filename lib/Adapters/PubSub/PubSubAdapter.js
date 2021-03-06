"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.PubSubAdapter = void 0;

/*eslint no-unused-vars: "off"*/

/**
 * @module Adapters
 */

/**
 * @interface PubSubAdapter
 */
class PubSubAdapter {
  /**
   * @returns {PubSubAdapter.Publisher}
   */
  static createPublisher() {}
  /**
   * @returns {PubSubAdapter.Subscriber}
   */


  static createSubscriber() {}

}
/**
 * @interface Publisher
 * @memberof PubSubAdapter
 */


exports.PubSubAdapter = PubSubAdapter;
var _default = PubSubAdapter;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9BZGFwdGVycy9QdWJTdWIvUHViU3ViQWRhcHRlci5qcyJdLCJuYW1lcyI6WyJQdWJTdWJBZGFwdGVyIiwiY3JlYXRlUHVibGlzaGVyIiwiY3JlYXRlU3Vic2NyaWJlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOzs7O0FBR0E7OztBQUdPLE1BQU1BLGFBQU4sQ0FBb0I7QUFDekI7OztBQUdBLFNBQU9DLGVBQVAsR0FBeUIsQ0FBRTtBQUMzQjs7Ozs7QUFHQSxTQUFPQyxnQkFBUCxHQUEwQixDQUFFOztBQVJIO0FBVzNCOzs7Ozs7O2VBOEJlRixhIiwic291cmNlc0NvbnRlbnQiOlsiLyplc2xpbnQgbm8tdW51c2VkLXZhcnM6IFwib2ZmXCIqL1xuLyoqXG4gKiBAbW9kdWxlIEFkYXB0ZXJzXG4gKi9cbi8qKlxuICogQGludGVyZmFjZSBQdWJTdWJBZGFwdGVyXG4gKi9cbmV4cG9ydCBjbGFzcyBQdWJTdWJBZGFwdGVyIHtcbiAgLyoqXG4gICAqIEByZXR1cm5zIHtQdWJTdWJBZGFwdGVyLlB1Ymxpc2hlcn1cbiAgICovXG4gIHN0YXRpYyBjcmVhdGVQdWJsaXNoZXIoKSB7fVxuICAvKipcbiAgICogQHJldHVybnMge1B1YlN1YkFkYXB0ZXIuU3Vic2NyaWJlcn1cbiAgICovXG4gIHN0YXRpYyBjcmVhdGVTdWJzY3JpYmVyKCkge31cbn1cblxuLyoqXG4gKiBAaW50ZXJmYWNlIFB1Ymxpc2hlclxuICogQG1lbWJlcm9mIFB1YlN1YkFkYXB0ZXJcbiAqL1xuaW50ZXJmYWNlIFB1Ymxpc2hlciB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gY2hhbm5lbCB0aGUgY2hhbm5lbCBpbiB3aGljaCB0byBwdWJsaXNoXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIHRoZSBtZXNzYWdlIHRvIHB1Ymxpc2hcbiAgICovXG4gIHB1Ymxpc2goY2hhbm5lbDogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpOiB2b2lkO1xufVxuXG4vKipcbiAqIEBpbnRlcmZhY2UgU3Vic2NyaWJlclxuICogQG1lbWJlcm9mIFB1YlN1YkFkYXB0ZXJcbiAqL1xuaW50ZXJmYWNlIFN1YnNjcmliZXIge1xuICAvKipcbiAgICogY2FsbGVkIHdoZW4gYSBuZXcgc3Vic2NyaXB0aW9uIHRoZSBjaGFubmVsIGlzIHJlcXVpcmVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBjaGFubmVsIHRoZSBjaGFubmVsIHRvIHN1YnNjcmliZVxuICAgKi9cbiAgc3Vic2NyaWJlKGNoYW5uZWw6IHN0cmluZyk6IHZvaWQ7XG5cbiAgLyoqXG4gICAqIGNhbGxlZCB3aGVuIHRoZSBzdWJzY3JpcHRpb24gZnJvbSB0aGUgY2hhbm5lbCBzaG91bGQgYmUgc3RvcHBlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gY2hhbm5lbFxuICAgKi9cbiAgdW5zdWJzY3JpYmUoY2hhbm5lbDogc3RyaW5nKTogdm9pZDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgUHViU3ViQWRhcHRlcjtcbiJdfQ==