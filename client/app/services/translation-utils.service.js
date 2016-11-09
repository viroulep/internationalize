import yaml from 'js-yaml';

 /**
  * Introduction & Wording
  *
  * Across the app we use so called *processed data*, which is computed from a *raw* one (parsed from YAML to JSON).
  * It has its most inner keys changed from the original form to an object:
  *
  * {
  *   _original: 'Original value',
  *   _translated: 'Translated value'
  * }
  *
  * In most cases a *key* apart from the standart meaning, refers to the most inner key of a translation data.
  * For example en.common.here with a value of { _original: 'Here', _translated: 'Ici' }.
  */

/**
 * A class meant for a translation data manipulation.
 */
export default class TranslationUtils {
  constructor($http, $q) {
    'ngInject';

    this.$http = $http;
    this.$q = $q;
  }

  /**
   * Fetches a translation data from the given URL.
   *
   * @param {Object} url A URL to pull the data from.
   * @param {Object} [data] A processed data to supplement the fetched data when possible
                            and to be used in statistics computation.
   * @return {Promise} Resolves to an object with these properties:
   *                  - newData (the fetched data spplemented with the given one)
   *                  - newUntranslatedKeysCount (a count of the keys that are in the fetched data
   *                                              but are not present in the given one)
   *                  - unusedTranslatedKeysCount (a count of the keys that are translated in the given data
   *                                               but are not present in the fetched one)
   */
  pullRemoteData(url, data = {}) {
    if(!url) return this.$q.reject('You must provide a URL.');
    return this.$http.get(url)
      .then(response => {
        let remoteData = yaml.safeLoad(response.data);
        let { newData, newUntranslatedKeysCount } = this.buildNewData(data, remoteData);
        let unusedTranslatedKeysCount = this.unusedTranslatedKeysCount(data, newData);
        return {
          newData,
          newUntranslatedKeysCount,
          unusedTranslatedKeysCount
        };
      });
  }

  /**
   * Builds a new translation processed data from the provided raw *latestData*.
   * Takes translations from the processed *data* if they are present.
   * Results in a new object with inner keys of the form
   * { _original: <from *latestData*>, _translated: <optionally from *data*> }
   *
   * @param {Object} data A processed data.
   * @param {Object} latestData A raw data.
   * @return {Object} With two properties:
   *                  - newData (the *latestData* spplemented with the given *data*)
   *                  - newUntranslatedKeysCount (a count of the inner keys that are in the *latestData* and are not in the *data*)
   */
  buildNewData(data, latestData) {
    let newData = {};
    let newUntranslatedKeysCount = 0;

    let buildNewDataRecursive = (newData, data, latestData) => {
      for(let key in latestData) {
        if(typeof latestData[key] === 'object') {
          newData[key] = {};
          buildNewDataRecursive(newData[key], data[key] || {}, latestData[key]);
        } else {
          newData[key] = {
            _original: latestData[key],
            _translated: null
          };
          if(latestData[key] === '') {
            newData[key]._translated = ''; // Don't bother with translating empty strings.
          } else if(data.hasOwnProperty(key)) {
            newData[key]._translated = data[key]._translated;
          } else {
            newUntranslatedKeysCount++;
          }
        }
      }
    };
    buildNewDataRecursive(newData, data || {}, latestData);

    return { newData, newUntranslatedKeysCount };
  }

  /**
   * Counts the translated keys that are present in the first object but are not in the second one.
   *
   * @param {Object} data A processed data to be compared.
   * @param {Object} latestData A processed data to compare with.
   * @return {Number}
   */
  unusedTranslatedKeysCount(data, latestData) {
    if(!data) return 0;

    let unusedTranslatedKeysCount = 0;
    let unusedTranslatedKeysCountRecursive = (data, latestData) => {
      for(let key in data) {
        if(data.hasOwnProperty('_translated')) continue;

        if(latestData.hasOwnProperty(key)) {
          unusedTranslatedKeysCountRecursive(data[key], latestData[key]);
        } else {
           /* Note: a bigger part of the object could have been removed.
              The following works in that case as well as when just one key is removed. */
          let { translatedCount: unusedInnerTranslatedKeysCount } = this.statistics({ [key]: data[key] });
          unusedTranslatedKeysCount += unusedInnerTranslatedKeysCount;
        }
      }
    };
    unusedTranslatedKeysCountRecursive(data, latestData);

    return unusedTranslatedKeysCount;
  }

  /**
   * Returns a new data that is the raw representation of the given processed data.
   *
   * @param {Object} processedData.
   * @return {Object}
   */
  processedDataToRaw(processedData) {
    let rawData = {};
    for(let key in processedData) {
      let child = processedData[key];
      rawData[key] = child.hasOwnProperty('_translated')
                   ? child._translated
                   : this.processedDataToRaw(child);
    }

    return rawData;
  }

  /**
   * Returns the YAML representation of the given processed data.
   *
   * @param {Object} processedData
   * @return {String} A YAML document.
   */
  processedDataToYaml(processedData) {
    return yaml.safeDump(this.processedDataToRaw(processedData));
  }

  /**
   * Computes the number of keys that are translated as well as the overall count.
   *
   * @param {Object} data A processed data.
   * @return {Object} With two properties:
   *                  - translatedCount
   *                  - overallCount
   */
  statistics(data) {
    let overallCount = 0;
    let translatedCount = 0;

    let statisticsRecursive = (data) => {
      for(let key in data) {
        let child = data[key];
        if(child.hasOwnProperty('_translated')) {
          /* Skip translations of empty strings, which are added automatically. */
          if(child._translated !== '') {
            overallCount++;
            if(child._translated !== null) {
              translatedCount++;
            }
          }
        } else {
          statisticsRecursive(child);
        }
      }
    };
    statisticsRecursive(data);

    return {
      overallCount,
      translatedCount
    };
  }

  /**
   * A generator function that iterates over the given data
   * and yields only those keys that haven't been translated yet.
   *
   * Yields objects with two properties:
   *  - key (an actual translation key)
   *  - chain (an array with the object keys hierarchy)
   *
   * @param {Object} data A processed data.
   */
  *untranslatedKeysGenerator(data, _chain = []) {
    for(let key in data) {
      let child = data[key];
      let chain = [..._chain, key];
      if(child.hasOwnProperty('_translated')) {
        if(child._translated === null) {
          yield { key: child, chain };
        }
      } else {
        yield *this.untranslatedKeysGenerator(child, chain);
      }
    }
  }
}
